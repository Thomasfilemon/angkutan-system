// backend/src/utils/runSingleMigration.js
// Helper to run a single SQL migration file, e.g.:
//   node src/utils/runSingleMigration.js 20251228_add_usage_odometer_serial.sql

const fs = require("fs");
const path = require("path");
const db = require("./db");

const run = async () => {
  const fileArg = process.argv[2];

  if (!fileArg) {
    console.error("❌ Please provide a migration filename, e.g.:");
    console.error("   node src/utils/runSingleMigration.js 20251228_add_usage_odometer_serial.sql");
    process.exit(1);
  }

  const migrationPath = path.resolve(__dirname, "../migrations", fileArg);

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  try {
    console.log(`▶ Running migration file: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath).toString();
    await db.pool.query(sql);
    console.log("✅ Migration executed successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  }
};

run();


