# RMK Groups Database Setup Guide

## Database Connection Details
- **Host**: 142.132.248.161
- **Database**: masterbe_rmk
- **Username**: masterbe_admin
- **Password**: RMK@1987
- **Port**: 3306

## Setup Instructions

### 1. Run the Database Schema
Execute the SQL script to create the necessary tables:

```sql
-- Run this in your MySQL database
mysql -h 142.132.248.161 -u masterbe_admin -p masterbe_rmk < setup_database.sql
```

Or copy the contents of `setup_database.sql` and run it in your MySQL client.

### 2. Start the Application
```bash
npm start
```

The server will automatically connect to your MySQL database and test the connection on startup.

### 3. Verify Connection
You should see "Database connected successfully" in the console when the server starts.

## What Was Changed

1. **Dependencies Added**: `mysql2` and `dotenv` for MySQL connection and environment variables
2. **Configuration Files**:
   - `.env` - Contains database connection details
   - `db.js` - Database connection module with connection pooling
   - `setup_database.sql` - SQL script to create the `app_data` table
3. **Server Updates**:
   - Replaced JSON file storage with MySQL database
   - Updated `/api/data` endpoint to read from MySQL
   - Updated `/api/sync` endpoint to write to MySQL with proper transaction handling
   - Maintained the same API contract for frontend compatibility

## Database Structure

The application uses a simple key-value storage approach in the `app_data` table:
- `data_key` - Primary key for storing data keys (e.g., 'rmk_customers', 'rmk_invoices')
- `data_value` - JSON string containing the actual data
- `created_at` and `updated_at` - Timestamps for tracking

This maintains compatibility with the existing frontend while providing a robust MySQL backend.

## Testing the Connection

Start the server and check the console output:
```bash
npm start
```

You should see:
```
Database connected successfully
RMK Cloud Sync Server running on port 3000
http://localhost:3000
```

If there are connection issues, the error will be logged to the console.
