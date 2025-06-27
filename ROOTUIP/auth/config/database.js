const { Sequelize } = require('sequelize');
const path = require('path');

// Database configuration for enterprise auth system
const config = {
  development: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database/auth_dev.db'),
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  production: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database/auth_prod.db'),
    logging: false,
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  postgres: {
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'rootuip_auth',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    logging: false,
    pool: {
      max: 50,
      min: 5,
      acquire: 30000,
      idle: 10000
    }
  }
};

const environment = process.env.NODE_ENV || 'development';
const dbConfig = config[environment];

const sequelize = new Sequelize(dbConfig);

// Test connection
sequelize.authenticate()
  .then(() => {
    console.log(`✅ Database connection established (${environment})`);
  })
  .catch(err => {
    console.error('❌ Unable to connect to database:', err);
  });

module.exports = { sequelize, config };