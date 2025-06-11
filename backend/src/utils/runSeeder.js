// backend/src/utils/runSeeder.js
const fs = require("fs");
const path = require("path");
const db = require("./db");

const run = async () => {
  try {
    const sql = fs
      .readFileSync(path.resolve(__dirname, "../migrations/seeder.sql"))
      .toString();
    await db.pool.query(sql);
    console.log("✅ Seeder executed successfully, now execute npm run hash-passwords");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeder error:", err);
    process.exit(1);
  }
};

run();
