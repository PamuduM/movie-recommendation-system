const { Watchlist, Movie } = require('../models');

const normalizeGenres = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'number' ? String(item) : String(item || '').trim()))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const buildMoviePayload = (movieId, movieData = {}) => {
  const releaseDate = movieData.releaseDate ?? movieData.release_date ?? null;
  const poster = movieData.poster ?? movieData.poster_path ?? null;
  const description = movieData.description ?? movieData.overview ?? null;
  const genres = normalizeGenres(movieData.genres ?? movieData.genre_ids);
  const title = movieData.title ?? movieData.name ?? `Movie #${movieId}`;
  return {
    id: movieId,
    title,
    description,
    releaseDate,
    poster,
    genres,
  };
};

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
    const numericMovieId = Number(req.body.movieId);
    if (!Number.isInteger(numericMovieId)) {
      return res.status(400).json({ error: 'Invalid movieId' });
    }

    let movie = await Movie.findByPk(numericMovieId);
    if (!movie && req.body.movie) {
      const payload = buildMoviePayload(numericMovieId, req.body.movie);
      movie = await Movie.create(payload);
    }

    if (!movie) {
      return res.status(400).json({ error: 'Movie not found. Provide metadata to create it automatically.' });
    }

    const [entry, created] = await Watchlist.findOrCreate({
      where: { userId: req.user.id, movieId: numericMovieId },
      defaults: { userId: req.user.id, movieId: numericMovieId },
    });

    await entry.reload({ include: [Movie] });
    res.status(created ? 201 : 200).json(entry);
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
