require('dotenv').config();
const mysql = require('mysql2/promise');

async function test() {
    console.log('Testing connection with:');
    console.log('Host:', process.env.DB_HOST || 'localhost');
    console.log('User:', process.env.DB_USER);
    console.log('DB:', process.env.DB_NAME);
    
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        console.log('SUCCESS: Connected to database');
        await connection.end();
    } catch (err) {
        console.error('FAILURE: Could not connect to database');
        console.error(err.message);
    }
}

test();
