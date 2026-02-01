const express = require('express');
const { body } = require('express-validator');
const favoriteController = require('../controllers/favoriteController');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const router = express.Router();

router.get('/:userId', auth, favoriteController.getFavoritesByUser);
router.post('/', auth, [
  body('movieId').isInt(),
], validateRequest, favoriteController.addToFavorites);
router.delete('/:id', auth, favoriteController.removeFromFavorites);

module.exports = router;
