const { Sequelize } = require('sequelize');
require('dotenv').config();

const dialect = (process.env.DB_DIALECT || 'sqlite').toLowerCase();

const sqliteRetryConfig = {
  max: 8,
  match: [/SQLITE_BUSY/i, /SQLITE_LOCKED/i, /database is locked/i],
};

const sequelize =
  dialect === 'sqlite'
    ? new Sequelize({
        dialect: 'sqlite',
        storage: process.env.DB_STORAGE || 'dev.sqlite',
        dialectOptions: {
          busyTimeout: 10000,
        },
        pool: {
          max: 1,
          min: 0,
          idle: 10000,
          acquire: 60000,
        },
        retry: sqliteRetryConfig,
        logging: false,
      })
    : new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
        host: process.env.DB_HOST,
        dialect: 'postgres',
        logging: false,
      });

module.exports = sequelize;
