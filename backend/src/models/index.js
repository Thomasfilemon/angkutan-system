const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: console.log,
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

const db = {};

// Import models - only the ones that exist
const modelFiles = ['trip', 'user', 'vehicle']; // Add model names as you create them

modelFiles.forEach(modelName => {
  try {
    const model = require(`./${modelName}`)(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
    console.log(`✅ ${model.name} model loaded`);
  } catch (error) {
    console.error(`❌ Error loading ${modelName} model:`, error.message);
  }
});

// Set up associations AFTER all models are loaded
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    try {
      db[modelName].associate(db);
      console.log(`✅ ${modelName} associations set up`);
    } catch (error) {
      console.error(`❌ Error setting up ${modelName} associations:`, error.message);
    }
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
