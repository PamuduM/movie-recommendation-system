const express = require('express');
const { body } = require('express-validator');
const watchlistController = require('../controllers/watchlistController');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const router = express.Router();

router.get('/:userId', auth, watchlistController.getWatchlistByUser);
router.post(
  '/',
  auth,
  [
    body('movieId').isInt().withMessage('movieId must be an integer'),
    body('movie')
      .optional({ nullable: true })
      .isObject()
      .withMessage('movie metadata must be an object when provided'),
    body('movie.title').optional().isString(),
    body('movie.description').optional().isString(),
    body('movie.overview').optional().isString(),
    body('movie.poster').optional().isString(),
    body('movie.poster_path').optional().isString(),
    body('movie.releaseDate').optional().isString(),
    body('movie.release_date').optional().isString(),
    body('movie.genres').optional().isArray(),
    body('movie.genre_ids').optional().isArray(),
  ],
  validateRequest,
  watchlistController.addToWatchlist
);
router.delete('/:id', auth, watchlistController.removeFromWatchlist);

module.exports = router;
