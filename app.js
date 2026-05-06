const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Database Configuration
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS app_data (
                data_key VARCHAR(255) PRIMARY KEY,
                data_value LONGTEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Connected & Table Verified');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Failed:', error.message);
        return false;
    }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true
});

app.use(cors());

// Serve Socket.io client script directly via Express to fix 404 on Hostinger/Passenger
app.get('*/socket.io/socket.io.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));
});
app.get('*/socket.io/socket.io.min.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.min.js'));
});

// Fallback to route Socket.io connection requests to the engine
app.all('*/socket.io/*', (req, res) => {
    if (io && io.engine) {
        io.engine.handleRequest(req, res);
    } else {
        res.status(500).send('Socket.io server not initialized');
    }
});

app.get('*/health', (req, res) => res.send('App is running! Database name: ' + process.env.DB_NAME));
app.get('/db-check', async (req, res) => {
    try {
        const connected = await testConnection();
        res.json({ status: connected ? 'connected' : 'failed', host: process.env.DB_HOST });
    } catch(e) { res.status(500).json({ error: e.message }); }
});
// Support large payloads for image base64 formats
app.use(express.json({ limit: '50mb' }));

// Serve all static HTML/JS/CSS files from this directory
app.use(express.static(path.join(__dirname)));

// Explicit root route to fix "Cannot GET /" on some hosting environments
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Test database connection on startup
testConnection();

// Store connected users
const connectedUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Join user to their role-based room
    socket.on('join-room', (userData) => {
        const { role, userId, name } = userData;
        socket.userId = userId;
        socket.userRole = role;
        socket.userName = name;
        
        // Join role-based room
        socket.join(role);
        socket.join('all-users'); // General room for all users
        
        // Store user info
        connectedUsers.set(socket.id, {
            userId,
            role,
            name,
            socketId: socket.id,
            connectedAt: new Date()
        });
        
        console.log(`${name} (${role}) joined the room`);
        
        // Notify others about new user
        socket.to('all-users').emit('user-joined', {
            userId,
            name,
            role,
            message: `${name} (${role}) is now online`
        });
        
        // Send current user list to new user
        const userList = Array.from(connectedUsers.values());
        socket.emit('user-list', userList);
    });
    
    // Handle billing updates
    socket.on('billing-update', (data) => {
        console.log('Billing update received:', data);
        
        // Broadcast to all users in real-time
        io.to('all-users').emit('billing-changed', {
            type: data.type || 'update',
            invoice: data.invoice,
            updatedBy: socket.userName || 'Unknown User',
            updatedAt: new Date(),
            message: data.message || 'Billing data updated'
        });
    });
    
    // Handle new invoice creation
    socket.on('new-invoice', (invoiceData) => {
        console.log('New invoice created:', invoiceData);
        
        // Broadcast to all users immediately
        io.to('all-users').emit('invoice-created', {
            invoice: invoiceData,
            createdBy: socket.userName || 'Unknown User',
            createdAt: new Date(),
            message: `New invoice ${invoiceData.invoiceNumber} created by ${socket.userName || 'Unknown User'}`
        });
    });
    
    // Handle invoice updates
    socket.on('invoice-updated', (invoiceData) => {
        console.log('Invoice updated:', invoiceData);
        
        // Broadcast to all users
        io.to('all-users').emit('invoice-updated', {
            invoice: invoiceData,
            updatedBy: socket.userName || 'Unknown User',
            updatedAt: new Date(),
            message: `Invoice ${invoiceData.invoiceNumber} updated by ${socket.userName || 'Unknown User'}`
        });
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            console.log(`${user.name} (${user.role}) disconnected`);
            
            // Notify others
            socket.to('all-users').emit('user-left', {
                userId: user.userId,
                name: user.name,
                role: user.role,
                message: `${user.name} (${user.role}) is now offline`
            });
            
            // Remove from connected users
            connectedUsers.delete(socket.id);
        }
    });
});

// Make io available to routes
app.set('io', io);

// UNIQUE SYNC ENDPOINTS (Cleaned for better routing)
app.get('/rmk-cloud-sync', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT data_key, data_value FROM app_data');
        const result = {};
        rows.forEach(row => { result[row.data_key] = row.data_value; });
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: 'DB Error', details: e.message });
    }
});

app.post('/rmk-sync-write', async (req, res) => {
    const { key, value } = req.body;
    
    // Ignore volatile local session keys
    if (key === 'rmk_session') {
        return res.json({ success: true, message: "Session ignored" });
    }

    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Check if key already exists
        const [existingRows] = await connection.execute(
            'SELECT data_value FROM app_data WHERE data_key = ?', 
            [key]
        );
        
        let finalValue = value;
        
        // Smart Conflict Avoidance: If pushing an array (like customers/invoices),
        // we can merge incoming array over the existing one to prevent simple overwrites
        if (key.startsWith('rmk_') && existingRows.length > 0) {
            try {
                const incoming = JSON.parse(value);
                if (Array.isArray(incoming)) {
                    const existing = JSON.parse(existingRows[0].data_value);
                    
                    // Keep existing, override with matched incomings by ID, append new ones
                    const map = new Map();
                    existing.forEach(item => { if(item && item.id) map.set(item.id, item); });
                    incoming.forEach(item => { if(item && item.id) map.set(item.id, item); });
                    
                    // Ensure the order prioritizes newer items (typically inserted at index 0)
                    const mergedArray = Array.from(map.values());
                    
                    // Sort descending by ID assuming ID is a timestamp or incremental
                    mergedArray.sort((a,b) => b.id - a.id);
                    
                    finalValue = JSON.stringify(mergedArray);
                }
            } catch (e) {
                // Fallback to raw string if JSON parsing fails
                finalValue = value;
            }
        }
        
        // Insert or update the key-value pair
        await connection.execute(
            'INSERT INTO app_data (data_key, data_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE data_value = ?',
            [key, finalValue, finalValue]
        );
        
        await connection.commit();
        
        // Notify other connected clients to refresh this key
        const serverIo = req.app.get('io');
        if (serverIo) {
            // Exclude the sender if possible? The sender does the API sync so they already have it.
            // Broadcasting to 'all-users' is fine, they'll verify if they need an update.
            serverIo.to('all-users').emit('cloud-data-changed', { key: key });
        }
        
        res.json({ success: true });
        
    } catch (e) {
        await connection.rollback();
        console.error("Sync Error:", e);
        res.status(500).json({ error: 'Database write error' });
    } finally {
        connection.release();
    }
});

// Start Server automatically depending on environment (like Render/Heroku defaults to process.env.PORT)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`RMK Cloud Sync Server running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
    console.log('WebSocket server ready for real-time updates');
});
