const express = require('express');
const { body } = require('express-validator');
const watchlistController = require('../controllers/watchlistController');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const router = express.Router();

router.get('/:userId', auth, watchlistController.getWatchlistByUser);
router.post('/', auth, [
  body('movieId').isInt(),
], validateRequest, watchlistController.addToWatchlist);
router.delete('/:id', auth, watchlistController.removeFromWatchlist);

module.exports = router;
