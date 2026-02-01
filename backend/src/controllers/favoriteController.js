const { Favorite, Movie } = require('../models');

exports.getFavoritesByUser = async (req, res) => {
  try {
    const requestedUserId = Number(req.params.userId);
    if (!Number.isInteger(requestedUserId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    if (requestedUserId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const favorites = await Favorite.findAll({
      where: { userId: requestedUserId },
      include: [Movie]
    });
    res.json(favorites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addToFavorites = async (req, res) => {
  try {
    const { movieId } = req.body;
    const entry = await Favorite.create({ userId: req.user.id, movieId });
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.removeFromFavorites = async (req, res) => {
  try {
    const entry = await Favorite.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    if (entry.userId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    await entry.destroy();
    res.json({ message: 'Removed from favorites' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
