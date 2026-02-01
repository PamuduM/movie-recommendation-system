const express = require('express');
const { Op } = require('sequelize');
const { Movie } = require('../models');
const router = express.Router();

// Search movies by title or genre
router.get('/', async (req, res) => {
  try {
    const { q, genre } = req.query;
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
    const movies = await Movie.findAll({ where });
    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
