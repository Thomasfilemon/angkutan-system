const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config/database');
require('dotenv').config();

// Get the environment (defaults to 'development')
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Create Sequelize instance with proper config
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
  }
);

// Test the connection
sequelize.authenticate()
  .then(() => {
    console.log('✅ PostgreSQL connection established successfully.');
  })
  .catch(err => {
    console.error('❌ Unable to connect to PostgreSQL:', err);
  });

// Initialize models object
const models = {};

// Add models as you create them
// models.User = require('./User')(sequelize, DataTypes);
// models.Trip = require('./Trip')(sequelize, DataTypes);
// models.Vehicle = require('./Vehicle')(sequelize, DataTypes);
// models.DriverExpense = require('./DriverExpense')(sequelize, DataTypes);

// Set up associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;
