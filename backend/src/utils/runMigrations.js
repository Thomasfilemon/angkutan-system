// backend/src/utils/runMigrations.js
const fs = require("fs");
const path = require("path");
const db = require("./db");

const run = async () => {
  try {
    const sql = fs
      .readFileSync(path.resolve(__dirname, "../migrations/init.sql"))
      .toString();
    await db.pool.query(sql);
    console.log("✅ Migrations executed successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  }
};

run();
