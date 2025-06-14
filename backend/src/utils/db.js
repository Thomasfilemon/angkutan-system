const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20,
});

// Event listeners for pool error handling
pool.on("error", (err, client) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// Test connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log("Connected to PostgreSQL database");
    client.release();
  } catch (err) {
    console.error("Error connecting to PostgreSQL:", err.stack);
    process.exit(-1);
  }
};

testConnection();

module.exports = {
  query: async (text, params) => {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log("Executed query", { text, duration, rows: res.rowCount });
      return res;
    } catch (err) {
      console.error("Database query error:", err);
      throw err;
    }
  },
  getClient: async () => {
    const client = await pool.connect();
    const query = client.query;
    const release = client.release;

    // Set a timeout of 5 seconds on idle clients
    const timeout = setTimeout(() => {
      console.error("A client has been checked out for too long.");
      console.error(
        `The last executed query on this client was: ${client.lastQuery}`
      );
    }, 5000);

    // Monkey patch the query method to keep track of the last query executed
    client.query = (...args) => {
      client.lastQuery = args;
      return query.apply(client, args);
    };

    client.release = () => {
      clearTimeout(timeout);
      client.query = query;
      client.release = release;
      return release.apply(client);
    };

    return client;
  },
  pool,
};
