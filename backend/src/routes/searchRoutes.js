const express = require('express');
const { Op } = require('sequelize');
const { Movie } = require('../models');
const router = express.Router();

const clampYear = (value) => {
  if (value === undefined || value === null) return null;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return null;
  const MIN_YEAR = 1888;
  const MAX_YEAR = new Date().getFullYear() + 5;
  return Math.min(Math.max(parsed, MIN_YEAR), MAX_YEAR);
};

// Search movies by title or genre
router.get('/', async (req, res) => {
  try {
    const { q, genre, yearMin, yearMax } = req.query;
    const dialect = Movie.sequelize.getDialect();
    const where = {};
    if (q) {
      const op = dialect === 'postgres' ? Op.iLike : Op.like;
      where.title = { [op]: `%${q}%` };
    }
    if (genre) {
      if (dialect === 'postgres') {
        where.genres = { [Op.contains]: [genre] };
      } else {
        // SQLite stores JSON as TEXT; this is a simple substring match.
        where.genres = { [Op.like]: `%${genre}%` };
      }
    }
    const startYear = clampYear(yearMin);
    const endYear = clampYear(yearMax);
    if (startYear !== null || endYear !== null) {
      const resolvedStart = startYear ?? 1900;
      const resolvedEnd = endYear ?? new Date().getFullYear();
      const minYear = Math.min(resolvedStart, resolvedEnd);
      const maxYear = Math.max(resolvedStart, resolvedEnd);
      const rangeStart = new Date(Date.UTC(minYear, 0, 1));
      const rangeEnd = new Date(Date.UTC(maxYear, 11, 31, 23, 59, 59, 999));
      where.releaseDate = {
        ...(where.releaseDate ?? {}),
        [Op.between]: [rangeStart, rangeEnd],
      };
    }
    const movies = await Movie.findAll({ where });
    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
