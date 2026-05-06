const mysql = require('mysql2/promise');
const path = require('path');
// Force load .env from the current directory
require('dotenv').config({ path: path.join(__dirname, '.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        
        // Auto-create table
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

module.exports = { pool, testConnection };
