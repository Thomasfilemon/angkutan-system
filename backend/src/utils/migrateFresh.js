// backend/src/utils/migrateFresh.js
const fs = require("fs");
const path = require("path");
const db = require("./db");

const run = async () => {
  try {
    console.log("🗑️  Dropping all tables and types...");
    
    // First, get all custom ENUM types
    const enumTypesResult = await db.pool.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typtype = 'e' 
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `);
    
    const enumTypes = enumTypesResult.rows.map(row => row.typname);
    
    // Build drop statements for ENUM types
    const dropEnumStatements = enumTypes.map(typeName => 
      `DROP TYPE IF EXISTS ${typeName} CASCADE;`
    ).join('\n');
    
    const dropSQL = `
      -- Drop all tables in correct order
      DROP TABLE IF EXISTS tire_inspections CASCADE;
      DROP TABLE IF EXISTS payment_terms CASCADE;
      DROP TABLE IF EXISTS accounting_ritase CASCADE;
      DROP TABLE IF EXISTS office_expenses CASCADE;
      DROP TABLE IF EXISTS driver_expenses CASCADE;
      DROP TABLE IF EXISTS stock_transactions CASCADE;
      DROP TABLE IF EXISTS service_items CASCADE;
      DROP TABLE IF EXISTS vehicle_service CASCADE;
      DROP TABLE IF EXISTS cash_transactions CASCADE;
      DROP TABLE IF EXISTS payment_transactions CASCADE;
      DROP TABLE IF EXISTS delivery_orders CASCADE;
      DROP TABLE IF EXISTS trips CASCADE;
      DROP TABLE IF EXISTS vehicle_tires CASCADE;
      DROP TABLE IF EXISTS vehicles CASCADE;
      DROP TABLE IF EXISTS tire_inventory CASCADE;
      DROP TABLE IF EXISTS stock_items CASCADE;
      DROP TABLE IF EXISTS stock_categories CASCADE;
      DROP TABLE IF EXISTS driver_profiles CASCADE;
      DROP TABLE IF EXISTS admin_profiles CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      
      -- Drop all ENUM types dynamically
      ${dropEnumStatements}
      
      -- Drop sequences
      DROP SEQUENCE IF EXISTS users_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS admin_profiles_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS driver_profiles_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS stock_categories_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS stock_items_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS tire_inventory_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS vehicles_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS vehicle_tires_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS trips_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS delivery_orders_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS payment_transactions_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS cash_transactions_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS vehicle_service_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS service_items_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS stock_transactions_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS driver_expenses_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS office_expenses_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS accounting_ritase_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS payment_terms_id_seq CASCADE;
      DROP SEQUENCE IF EXISTS tire_inspections_id_seq CASCADE;
    `;
    
    console.log("Found ENUM types:", enumTypes);
    await db.pool.query(dropSQL);
    console.log("✅ All tables and types dropped successfully");

    console.log("🔄 Running migrations...");
    
    const migrationSQL = fs
      .readFileSync(path.resolve(__dirname, "../migrations/init.sql"))
      .toString();
    await db.pool.query(migrationSQL);
    console.log("✅ Migrations executed successfully");

    console.log("🌱 Running seeders...");
    
    const seederSQL = fs
      .readFileSync(path.resolve(__dirname, "../migrations/seeder.sql"))
      .toString();
    await db.pool.query(seederSQL);
    console.log("✅ Seeders executed successfully");

    console.log("🔐 Now execute npm run hash-passwords to hash user passwords");
    console.log("🎉 Fresh migration with seed completed successfully!");
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration fresh error:", err);
    process.exit(1);
  }
};

run();
