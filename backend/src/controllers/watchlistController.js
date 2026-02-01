const { Watchlist, Movie } = require('../models');

exports.getWatchlistByUser = async (req, res) => {
  try {
    const requestedUserId = Number(req.params.userId);
    if (!Number.isInteger(requestedUserId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    if (requestedUserId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const watchlist = await Watchlist.findAll({
      where: { userId: requestedUserId },
      include: [Movie]
    });
    res.json(watchlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addToWatchlist = async (req, res) => {
  try {
    const { movieId } = req.body;
    const entry = await Watchlist.create({ userId: req.user.id, movieId });
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.removeFromWatchlist = async (req, res) => {
  try {
    const entry = await Watchlist.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    if (entry.userId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    await entry.destroy();
    res.json({ message: 'Removed from watchlist' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
