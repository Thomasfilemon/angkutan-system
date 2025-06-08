// backend/src/utils/db.js
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  max: 20, // Maximum number of clients in the pool
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error("Error connecting to PostgreSQL:", err.stack);
  } else {
    console.log("Connected to PostgreSQL database");
    release();
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
