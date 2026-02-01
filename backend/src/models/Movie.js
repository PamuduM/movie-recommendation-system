const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genresType =
  sequelize.getDialect() === 'postgres' ? DataTypes.ARRAY(DataTypes.STRING) : DataTypes.JSON;

const Movie = sequelize.define('Movie', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  releaseDate: { type: DataTypes.DATE },
  poster: { type: DataTypes.STRING },
  genres: { type: genresType, defaultValue: [] },
  trailerUrl: { type: DataTypes.STRING },
}, {
  timestamps: true,
});

module.exports = Movie;
