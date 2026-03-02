// AI Recommendation Service (stub)
const { Op } = require('sequelize');
const axios = require('axios');
const sequelize = require('../config/database');
const { Movie, Favorite, Watchlist } = require('../models');

const TMDB_GENRE_ID_MAP = {
	comedy: 35,
	adventure: 12,
	animation: 16,
	drama: 18,
	romance: 10749,
	'slice of life': 18,
	family: 10751,
	action: 28,
	'sci-fi': 878,
	scifi: 878,
	thriller: 53,
	crime: 80,
};

const MOOD_PRESETS = {
	happy: {
		label: 'Happy',
		genres: ['Comedy', 'Adventure', 'Animation'],
		keywords: ['happy', 'joy', 'celebrate', 'optimistic', 'glad', 'sunny'],
	},
	excited: {
		label: 'Excited',
		genres: ['Action', 'Adventure', 'Music'],
		keywords: ['excited', 'pumped', 'thrilled', 'energetic', 'party'],
	},
	calm: {
		label: 'Calm',
		genres: ['Drama', 'Slice of life'],
		keywords: ['calm', 'peaceful', 'relaxed', 'serene', 'chill'],
	},
	romantic: {
		label: 'Romantic',
		genres: ['Romance', 'Drama'],
		keywords: ['romantic', 'love', 'date', 'affection', 'caring'],
	},
	sad: {
		label: 'Blue',
		genres: ['Romance', 'Drama', 'Comedy'],
		keywords: ['sad', 'down', 'lonely', 'blue', 'upset'],
	},
	stressed: {
		label: 'Stressed',
		genres: ['Animation', 'Family', 'Comedy'],
		keywords: ['stressed', 'tired', 'burned', 'overwhelmed', 'anxious', 'drained'],
	},
	angry: {
		label: 'Angry',
		genres: ['Thriller', 'Crime', 'Action'],
		keywords: ['angry', 'mad', 'furious', 'rage', 'irritated', 'frustrated'],
	},
	bold: {
		label: 'Bold',
		genres: ['Action', 'Sci-Fi', 'Thriller'],
		keywords: ['bold', 'fearless', 'hyped', 'adrenaline', 'charged'],
	},
};

const DEFAULT_MOOD_KEY = 'happy';

const MOOD_SYNONYM_TABLE = {
	happy: [...MOOD_PRESETS.happy.keywords, 'cheerful', 'delighted', 'uplifted'],
	excited: [...MOOD_PRESETS.excited.keywords, 'amped', 'wired', 'buzzing'],
	calm: [...MOOD_PRESETS.calm.keywords, 'tranquil', 'soothing', 'meditative'],
	romantic: [...MOOD_PRESETS.romantic.keywords, 'sweet', 'lovey', 'crush'],
	sad: [...MOOD_PRESETS.sad.keywords, 'heartbroken', 'melancholy'],
	stressed: [...MOOD_PRESETS.stressed.keywords, 'burnt', 'frazzled'],
	angry: [...MOOD_PRESETS.angry.keywords, 'heated', 'fuming'],
	bold: [...MOOD_PRESETS.bold.keywords, 'brave', 'daring'],
};

const tmdbClient = process.env.TMDB_API_KEY
	? axios.create({
			baseURL: 'https://api.themoviedb.org/3',
			timeout: 10000,
			params: { api_key: process.env.TMDB_API_KEY },
		})
	: null;

const cleanText = (text = '') =>
	String(text)
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

const detectMoodFromText = (text = '') => {
	const normalized = cleanText(text);
	if (!normalized) return null;
	return (
		Object.entries(MOOD_SYNONYM_TABLE).find(([, synonyms]) =>
			synonyms.some((keyword) => normalized.includes(keyword))
		)?.[0] ?? null
	);
};

const normalizeGenres = (value) => {
	if (!value) return [];
	if (Array.isArray(value)) return value.filter(Boolean);
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) return parsed.filter(Boolean);
		} catch (err) {
			return value
				.split(',')
				.map((item) => item.trim())
				.filter(Boolean);
		}
		return value
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
	}
	return [];
};

const scoreMovieForMood = (movie, focusGenres) => {
	if (!focusGenres.length) return 0.5;
	const genres = normalizeGenres(movie.genres).map((genre) => genre.toLowerCase());
	if (!genres.length) return 0.1;
	const focus = focusGenres.map((genre) => genre.toLowerCase());
	const hits = genres.filter((genre) => focus.includes(genre));
	return hits.length / focus.length || 0.2;
};

const serializeMovie = (movie, moodLabel, moodScore) => ({
	id: movie.id,
	title: movie.title,
	overview: movie.description,
	poster_path: movie.poster,
	release_date: movie.releaseDate || movie.release_date || null,
	genres: normalizeGenres(movie.genres),
	moodTag: moodLabel,
	moodScore,
});

const serializeTmdbMovie = (movie, moodLabel, moodScore) => ({
	id: movie.id,
	title: movie.title,
	overview: movie.overview,
	poster_path: movie.poster_path,
	release_date: movie.release_date,
	genres: movie.genre_ids || [],
	moodTag: moodLabel,
	moodScore,
});

const fetchLatestMovies = async (limit = 50) => {
	const randomize = Math.random() > 0.5;
	return Movie.findAll({
		order: randomize ? sequelize.random() : [['updatedAt', 'DESC']],
		limit: Math.max(limit, 25),
	});
};

const jitterScore = (base, seedFactor = 0) => {
	const deterministic = Math.sin(seedFactor + base * 100) * 0.1;
	const noisy = base + deterministic + (Math.random() - 0.5) * 0.2;
	if (Number.isNaN(noisy)) return base;
	return Math.min(1, Math.max(0, noisy));
};

/**
 * Recommend movies for a user based on collaborative filtering, favorites, and watchlist.
 * This is a stub for integration with a real AI/ML model.
 */
exports.getRecommendationsForUser = async (userId, limit = 10) => {
	const watched = await Watchlist.findAll({ where: { userId } });
	const favorite = await Favorite.findAll({ where: { userId } });
	const excludeIds = [...watched.map((w) => w.movieId), ...favorite.map((f) => f.movieId)];
	const where = {};
	if (excludeIds.length > 0) {
		where.id = { [Op.notIn]: excludeIds };
	}

	const movies = await Movie.findAll({ where, order: [['createdAt', 'DESC']], limit });
	return movies;
};

exports.getMoodRecommendations = async ({ mood, textSample, limit = 12, fallbackGenres = [], refreshNonce } = {}) => {
	const normalizedMood = (mood || '').toLowerCase() || detectMoodFromText(textSample) || DEFAULT_MOOD_KEY;
	const moodConfig = MOOD_PRESETS[normalizedMood] || MOOD_PRESETS[DEFAULT_MOOD_KEY];
	const focusGenres = Array.from(new Set([...(moodConfig.genres || []), ...(fallbackGenres || [])]));
	const seed = Number.isFinite(Number(refreshNonce)) ? Number(refreshNonce) : Date.now();
	const candidates = await fetchLatestMovies(limit * 3);
	const scored = candidates.map((movie) => {
		const movieIdNumber = Number(movie.id) || Math.random();
		return {
			movie,
			score: jitterScore(scoreMovieForMood(movie, focusGenres), seed + movieIdNumber),
		};
	});
	scored.sort((a, b) => b.score - a.score);
	const positive = scored.filter((entry) => entry.score > 0).slice(0, limit);
	const selectedIds = new Set(positive.map((entry) => entry.movie.id));
	const recommendations = positive.map((entry) => serializeMovie(entry.movie, moodConfig.label, entry.score));

	if (recommendations.length < limit) {
		const remainder = scored
			.filter((entry) => !selectedIds.has(entry.movie.id))
			.slice(0, limit - recommendations.length)
			.map((entry) => serializeMovie(entry.movie, moodConfig.label, entry.score));
		remainder.forEach((item) => selectedIds.add(item.id));
		recommendations.push(...remainder);
	}

	let tmdbUsed = false;
	if (recommendations.length < limit && tmdbClient) {
		const tmdbFallback = await fetchTmdbForMood(focusGenres, limit - recommendations.length, moodConfig.label);
		tmdbFallback.forEach((item) => {
			if (!selectedIds.has(item.id)) {
				recommendations.push(item);
				selectedIds.add(item.id);
				tmdbUsed = true;
			}
		});
	}

	return {
		mood: { key: normalizedMood, label: moodConfig.label },
		meta: {
			focusGenres,
			source: tmdbUsed ? (recommendations.length ? 'local-db+tmdb' : 'tmdb') : 'local-db',
			totalMoviesScored: scored.length,
			refreshNonce: refreshNonce ?? null,
		},
		recommendations,
	};
};

async function fetchTmdbForMood(focusGenres, limit, moodLabel) {
	if (!tmdbClient) return [];
	const genreIds = Array.from(
		new Set(
			focusGenres
				.map((genre) => TMDB_GENRE_ID_MAP[genre.toLowerCase()] || null)
				.filter((value) => Number.isFinite(value))
		)
	);
	const useDiscover = genreIds.length > 0;
	const endpoint = useDiscover ? '/discover/movie' : '/trending/movie/week';
	const params = useDiscover
		? { with_genres: genreIds.join(','), sort_by: 'popularity.desc', page: 1 }
		: { time_window: 'week' };
	try {
		const response = await tmdbClient.get(endpoint, { params });
		const results = Array.isArray(response.data?.results) ? response.data.results : [];
		return results.slice(0, limit).map((movie, index) =>
			serializeTmdbMovie(movie, moodLabel, useDiscover ? 0.6 - index * 0.02 : 0.4 - index * 0.01)
		);
	} catch (err) {
		return [];
	}
}
