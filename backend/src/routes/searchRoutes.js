const express = require('express');
const { Op } = require('sequelize');
const { spawn } = require('child_process');
const { promises: fs } = require('fs');
const os = require('os');
const path = require('path');
const { Movie } = require('../models');
const router = express.Router();

const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || 'python';
const AI_RECOMMENDER_PATH = path.resolve(__dirname, '../../../ai/recommender.py');

const clampYear = (value) => {
  if (value === undefined || value === null) return null;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return null;
  const MIN_YEAR = 1888;
  const MAX_YEAR = new Date().getFullYear() + 5;
  return Math.min(Math.max(parsed, MIN_YEAR), MAX_YEAR);
};

const collectGenres = (...values) => {
  const results = [];
  const pushValue = (value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach(pushValue);
      return;
    }
    String(value)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => results.push(part));
  };
  values.forEach(pushValue);
  return Array.from(new Set(results));
};

const SORT_MAP = {
  'title-asc': [['title', 'ASC']],
  'title-desc': [['title', 'DESC']],
  'release-asc': [['releaseDate', 'ASC']],
  'release-desc': [['releaseDate', 'DESC']],
};

const resolveSortOrder = (sortKey) => SORT_MAP[sortKey] ?? SORT_MAP['release-desc'];

const toAiSort = (sortKey) => {
  if (sortKey === 'title-asc') return 'title-asc';
  if (sortKey === 'title-desc') return 'title-desc';
  if (sortKey === 'release-asc') return 'release-asc';
  if (sortKey === 'release-desc') return 'release-desc';
  return 'score-desc';
};

const runAiKeywordSearch = async ({ q, genres, yearMin, yearMax, sort }) => {
  const movies = await Movie.findAll({
    attributes: ['id', 'title', 'description', 'genres', 'releaseDate', 'poster', 'trailerUrl'],
    raw: true,
  });
  if (!movies.length) {
    return [];
  }

  const tmpFile = path.join(
    os.tmpdir(),
    `flickx-ai-search-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );

  await fs.writeFile(tmpFile, JSON.stringify({ movies }), 'utf8');

  const args = [
    AI_RECOMMENDER_PATH,
    '--mode',
    'keyword',
    '--input-json',
    tmpFile,
    '--query',
    q,
    '--top-n',
    '50',
    '--sort',
    toAiSort(sort),
  ];

  if (yearMin !== null) {
    args.push('--year-min', String(yearMin));
  }
  if (yearMax !== null) {
    args.push('--year-max', String(yearMax));
  }
  if (genres.length) {
    args.push('--genres', genres.join(','));
  }

  try {
    const output = await new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      const child = spawn(PYTHON_EXECUTABLE, args, {
        cwd: path.resolve(__dirname, '../../..'),
      });

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => reject(error));

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr.trim() || `Python process failed with exit code ${code}`));
          return;
        }
        try {
          const parsed = JSON.parse(stdout || '[]');
          resolve(Array.isArray(parsed) ? parsed : []);
        } catch (error) {
          reject(new Error('Failed to parse AI search output as JSON'));
        }
      });
    });

    const movieMap = new Map(movies.map((movie) => [Number(movie.id), movie]));
    return output
      .map((item) => {
        const movieId = Number(item?.movie_id);
        const movie = movieMap.get(movieId);
        if (!movie) return null;
        return {
          ...movie,
          aiScore: Number(item?.score ?? 0),
        };
      })
      .filter(Boolean);
  } finally {
    await fs.unlink(tmpFile).catch(() => undefined);
  }
};

// Search movies by title or genre
router.get('/', async (req, res) => {
  try {
    const { q, genre, genres, yearMin, yearMax, sort } = req.query;
    const dialect = Movie.sequelize.getDialect();
    const where = {};
    if (q) {
      const op = dialect === 'postgres' ? Op.iLike : Op.like;
      where.title = { [op]: `%${q}%` };
    }
    const requestedGenres = collectGenres(genre, genres);
    const startYear = clampYear(yearMin);
    const endYear = clampYear(yearMax);

    if (q) {
      try {
        const aiMovies = await runAiKeywordSearch({
          q,
          genres: requestedGenres,
          yearMin: startYear,
          yearMax: endYear,
          sort,
        });
        if (aiMovies.length) {
          return res.json(aiMovies);
        }
      } catch (error) {
        console.warn('AI keyword search failed. Falling back to SQL search.', error.message);
      }
    }

    if (requestedGenres.length) {
      if (dialect === 'postgres') {
        where.genres = { [Op.contains]: requestedGenres };
      } else {
        const genreFilters = requestedGenres.map((name) => ({
          genres: { [Op.like]: `%${name}%` },
        }));
        if (genreFilters.length === 1) {
          where.genres = genreFilters[0].genres;
        } else {
          where[Op.and] = [...(where[Op.and] ?? []), ...genreFilters];
        }
      }
    }
    if (startYear !== null || endYear !== null) {
      const resolvedStart = startYear ?? 1900;
      const resolvedEnd = endYear ?? new Date().getFullYear();
      const minYear = Math.min(resolvedStart, resolvedEnd);
      const maxYear = Math.max(resolvedStart, resolvedEnd);
      const rangeStart = new Date(Date.UTC(minYear, 0, 1));
      const rangeEnd = new Date(Date.UTC(maxYear, 11, 31, 23, 59, 59, 999));
      where.releaseDate = {
        ...(where.releaseDate ?? {}),
        [Op.between]: [rangeStart, rangeEnd],
      };
    }
    const movies = await Movie.findAll({ where, order: resolveSortOrder(sort) });
    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
