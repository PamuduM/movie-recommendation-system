const express = require('express');
const axios = require('axios');

const router = express.Router();

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const getApiKey = () => process.env.TMDB_API_KEY;

const tmdbClient = axios.create({
  baseURL: TMDB_BASE_URL,
  timeout: 10000,
});

const requireApiKey = (req, res, next) => {
  if (!getApiKey()) {
    return res.status(500).json({
      error: 'TMDB_API_KEY is not configured on the server',
    });
  }
  return next();
};

const withKey = (params = {}) => ({
  ...params,
  api_key: getApiKey(),
});

const extractRoleHints = (query = '') => {
  const lowered = String(query).toLowerCase();
  return {
    director: /\bdirector\b/.test(lowered),
    cast: /\bcast\b/.test(lowered),
    actor: /\bactor\b/.test(lowered),
    actress: /\bactress\b/.test(lowered),
  };
};

const stripRoleKeywords = (query = '') =>
  String(query)
    .replace(/\bdirector\b/gi, ' ')
    .replace(/\bcast\b/gi, ' ')
    .replace(/\bactor\b/gi, ' ')
    .replace(/\bactress\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

router.get('/trending', requireApiKey, async (req, res) => {
  try {
    const { time_window = 'week', page = 1 } = req.query;
    const response = await tmdbClient.get(`/trending/movie/${time_window}`, {
      params: withKey({ page }),
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/genres', requireApiKey, async (req, res) => {
  try {
    const response = await tmdbClient.get('/genre/movie/list', {
      params: withKey({ language: 'en-US' }),
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/discover', requireApiKey, async (req, res) => {
  try {
    const {
      sort_by = 'popularity.desc',
      with_genres,
      primary_release_year,
      page = 1,
    } = req.query;

    const response = await tmdbClient.get('/discover/movie', {
      params: withKey({
        sort_by,
        with_genres,
        primary_release_year,
        page,
        include_adult: false,
      }),
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/search', requireApiKey, async (req, res) => {
  try {
    const { query, page = 1 } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const response = await tmdbClient.get('/search/movie', {
      params: withKey({
        query,
        page,
        include_adult: false,
      }),
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/ai-search', requireApiKey, async (req, res) => {
  try {
    const { query, page = 1 } = req.query;
    if (!query || !String(query).trim()) {
      return res.status(400).json({ error: 'query is required' });
    }

    const roleHints = extractRoleHints(query);
    const personQuery = stripRoleKeywords(query) || String(query).trim();

    const peopleSearchResponse = await tmdbClient.get('/search/person', {
      params: withKey({
        query: personQuery,
        page: 1,
        include_adult: false,
      }),
    });

    const people = Array.isArray(peopleSearchResponse.data?.results)
      ? peopleSearchResponse.data.results
      : [];
    const topPeopleIds = people
      .filter((person) => person && typeof person.id === 'number')
      .slice(0, 5)
      .map((person) => person.id);

    if (!topPeopleIds.length) {
      return res.json({
        page: Number(page) || 1,
        results: [],
        total_pages: 0,
        total_results: 0,
      });
    }

    const discoverParams = {
      page,
      include_adult: false,
      sort_by: 'popularity.desc',
      language: 'en-US',
    };

    if (roleHints.director && !roleHints.cast && !roleHints.actor && !roleHints.actress) {
      discoverParams.with_crew = topPeopleIds.join('|');
    } else if (roleHints.cast || roleHints.actor || roleHints.actress) {
      discoverParams.with_cast = topPeopleIds.join('|');
    } else {
      discoverParams.with_people = topPeopleIds.join('|');
    }

    const discoverResponse = await tmdbClient.get('/discover/movie', {
      params: withKey(discoverParams),
    });

    return res.json(discoverResponse.data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;