const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config();

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'geopharm_bamenda',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Initialize database (create tables if they don't exist)
async function initializeDatabase() {
    try {
        const fs = require('fs').promises;
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        
        // Check if schema file exists
        try {
            await fs.access(schemaPath);
        } catch (error) {
            console.log('⚠️  Schema file not found, skipping database initialization');
            return false;
        }

        const schema = await fs.readFile(schemaPath, 'utf8');
        
        // Split schema into individual statements
        const statements = schema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        const connection = await pool.getConnection();
        
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await connection.execute(statement);
                } catch (error) {
                    // Ignore table already exists errors
                    if (!error.message.includes('already exists')) {
                        console.warn('⚠️  SQL Warning:', error.message);
                    }
                }
            }
        }
        
        connection.release();
        console.log('✅ Database schema initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        return false;
    }
}

// Execute query with error handling
async function executeQuery(query, params = []) {
    try {
        const [rows] = await pool.execute(query, params);
        return { success: true, data: rows };
    } catch (error) {
        console.error('Database query error:', error.message);
        return { success: false, error: error.message };
    }
}

// Execute transaction
async function executeTransaction(queries) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        const results = [];
        for (const { query, params } of queries) {
            const [rows] = await connection.execute(query, params || []);
            results.push(rows);
        }
        
        await connection.commit();
        return { success: true, data: results };
    } catch (error) {
        await connection.rollback();
        console.error('Transaction error:', error.message);
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

// Get database statistics
async function getDatabaseStats() {
    try {
        const queries = [
            'SELECT COUNT(*) as total_pharmacies FROM pharmacies',
            'SELECT COUNT(*) as approved_pharmacies FROM pharmacies WHERE status = "approved"',
            'SELECT COUNT(*) as total_drugs FROM drugs',
            'SELECT COUNT(*) as total_users FROM users',
            'SELECT COUNT(*) as open_flags FROM flags WHERE status = "open"'
        ];

        const stats = {};
        for (const query of queries) {
            const result = await executeQuery(query);
            if (result.success && result.data.length > 0) {
                const key = Object.keys(result.data[0])[0];
                stats[key] = result.data[0][key];
            }
        }

        return { success: true, data: stats };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Close database connection
async function closeConnection() {
    try {
        await pool.end();
        console.log('✅ Database connection closed');
    } catch (error) {
        console.error('❌ Error closing database connection:', error.message);
    }
}

module.exports = {
    pool,
    testConnection,
    initializeDatabase,
    executeQuery,
    executeTransaction,
    getDatabaseStats,
    closeConnection
};
