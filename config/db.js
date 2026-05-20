const { Pool } = require('pg');
require('dotenv').config({ quiet: true });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,

    ssl: {
        rejectUnauthorized: false,
    },
});

pool.connect()
    .then(client => {
        console.log('Connected to PostgreSQL');
        client.release();
    })
    .catch(err => {
        console.error('Database connection error:', err);
    });

pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL error', err);
});

module.exports = pool;