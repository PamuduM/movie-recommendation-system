const express = require('express');
const { body } = require('express-validator');
const movieController = require('../controllers/movieController');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const router = express.Router();

router.get('/', movieController.getAllMovies);
router.get('/:id', movieController.getMovieById);
router.post('/', auth, [
  body('title').notEmpty(),
], validateRequest, movieController.createMovie);
router.put('/:id', auth, movieController.updateMovie);
router.delete('/:id', auth, movieController.deleteMovie);

module.exports = router;
