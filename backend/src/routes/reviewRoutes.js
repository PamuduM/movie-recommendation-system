const express = require('express');
const { body } = require('express-validator');
const reviewController = require('../controllers/reviewController');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const router = express.Router();

router.get('/movie/:movieId', reviewController.getReviewsByMovie);
router.get('/user/:userId', reviewController.getReviewsByUser);
router.post('/', auth, [
  body('movieId').isInt(),
  body('rating').isFloat({ min: 0, max: 10 }),
  body('content').notEmpty(),
], validateRequest, reviewController.createReview);
router.put('/:id', auth, reviewController.updateReview);
router.delete('/:id', auth, reviewController.deleteReview);

module.exports = router;
