// AI Recommendation Service (stub)
const { Op } = require('sequelize');
const { Movie, Favorite, Watchlist } = require('../models');

/**
 * Recommend movies for a user based on collaborative filtering, favorites, and watchlist.
 * This is a stub for integration with a real AI/ML model.
 */
exports.getRecommendationsForUser = async (userId, limit = 10) => {
  // Example: Recommend top-rated movies not in user's watchlist or favorites
  // In production, replace with ML model or external AI service
  const watched = await Watchlist.findAll({ where: { userId } });
  const favorite = await Favorite.findAll({ where: { userId } });
  const excludeIds = [
    ...watched.map(w => w.movieId),
    ...favorite.map(f => f.movieId)
  ];
  const where = {};
  if (excludeIds.length > 0) {
    where.id = { [Op.notIn]: excludeIds };
  }

  const movies = await Movie.findAll({ where, order: [['createdAt', 'DESC']], limit });
  return movies;
};
