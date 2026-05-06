const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
    try {
        console.log('Testing database connection...');
        console.log(`Host: ${process.env.DB_HOST}`);
        console.log(`Database: ${process.env.DB_NAME}`);
        console.log(`User: ${process.env.DB_USER}`);
        
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });
        
        console.log('✅ Database connected successfully!');
        
        // Test the app_data table
        const [rows] = await connection.execute('SHOW TABLES LIKE "app_data"');
        if (rows.length > 0) {
            console.log('✅ app_data table exists');
        } else {
            console.log('❌ app_data table does not exist - please run setup_database.sql');
        }
        
        await connection.end();
        console.log('✅ Connection test completed');
        
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('Please check your credentials and network connection');
    }
}

testConnection();
