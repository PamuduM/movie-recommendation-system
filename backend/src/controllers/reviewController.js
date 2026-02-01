const { Review, Movie, User } = require('../models');

exports.getReviewsByMovie = async (req, res) => {
  try {
    const reviews = await Review.findAll({
      where: { movieId: req.params.movieId },
      include: [User]
    });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getReviewsByUser = async (req, res) => {
  try {
    const reviews = await Review.findAll({
      where: { userId: req.params.userId },
      include: [Movie]
    });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createReview = async (req, res) => {
  try {
    const review = await Review.create({ ...req.body, userId: req.user.id });
    res.status(201).json(review);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    if (review.userId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    await review.update(req.body);
    res.json(review);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    if (review.userId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    await review.destroy();
    res.json({ message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
