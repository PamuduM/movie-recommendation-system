const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Watchlist = sequelize.define('Watchlist', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  movieId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  timestamps: true,
});

module.exports = Watchlist;
