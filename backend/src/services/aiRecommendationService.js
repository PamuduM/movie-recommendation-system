// AI Recommendation Service (enhanced with Python hybrid model)
const { Op, fn, col } = require('sequelize');
const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const sequelize = require('../config/database');
const { Movie, Favorite, Watchlist, Review } = require('../models');

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

const BACKEND_ROOT = path.resolve(__dirname, '../..');
const PYTHON_SCRIPT_PATH = path.resolve(__dirname, '../../../ai/recommender.py');
const PYTHON_COMMANDS = [process.env.PYTHON_BIN, 'python3', 'python', 'py'].filter(Boolean);
const SQLITE_STORAGE_PATH = (() => {
	if (!sequelize || typeof sequelize.getDialect !== 'function') return null;
	if (sequelize.getDialect() !== 'sqlite') return null;
	const storage = sequelize.options?.storage;
	if (!storage) return null;
	return path.isAbsolute(storage) ? storage : path.resolve(BACKEND_ROOT, storage);
})();
const AI_SCRIPT_AVAILABLE = fs.existsSync(PYTHON_SCRIPT_PATH) && Boolean(SQLITE_STORAGE_PATH);

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

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

const buildRatingMap = async (movieIds = []) => {
	if (!Array.isArray(movieIds) || movieIds.length === 0) return new Map();
	try {
		const rows = await Review.findAll({
			attributes: [
				'movieId',
				[fn('AVG', col('rating')), 'avgRating'],
				[fn('COUNT', col('rating')), 'ratingCount'],
			],
			where: { movieId: movieIds },
			group: ['movieId'],
			raw: true,
		});
		return rows.reduce((acc, row) => {
			const movieId = Number(row.movieId);
			if (!movieId) return acc;
			const avgRating = Number(row.avgRating) || 0;
			const ratingCount = Number(row.ratingCount) || 0;
			const normalized = ratingCount ? clamp01(avgRating / 5) : 0;
			const confidence = ratingCount ? clamp01(Math.log10(1 + ratingCount) / 2) : 0;
			acc.set(movieId, {
				average: ratingCount ? avgRating : null,
				count: ratingCount,
				normalized,
				confidence,
			});
			return acc;
		}, new Map());
	} catch (err) {
		return new Map();
	}
};

const runPythonKeywordSearch = async ({ query, focusGenres = [], topN = 40 } = {}) => {
	if (!AI_SCRIPT_AVAILABLE || !query?.trim() || PYTHON_COMMANDS.length === 0) return null;
	const args = [
		PYTHON_SCRIPT_PATH,
		'--mode',
		'keyword',
		'--db',
		SQLITE_STORAGE_PATH,
		'--query',
		query.trim(),
		'--top-n',
		String(Math.max(topN, 10)),
		'--sort',
		'score-desc',
	];
	if (focusGenres.length) {
		args.push('--genres', focusGenres.join(','));
	}
	for (const command of PYTHON_COMMANDS) {
		if (!command) continue;
		const payload = await spawnPython(command, args);
		if (payload) return payload;
	}
	return null;
};

const spawnPython = (command, args) =>
	new Promise((resolve) => {
		let stdout = '';
		let stderr = '';
		let child;
		try {
			child = spawn(command, args, { cwd: BACKEND_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
		} catch (err) {
			return resolve(null);
		}
		child.stdout.on('data', (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr.on('data', (chunk) => {
			stderr += chunk.toString();
		});
		child.on('error', () => resolve(null));
		child.on('close', (code) => {
			if (code !== 0) return resolve(null);
			const trimmed = stdout.trim();
			if (!trimmed) return resolve([]);
			const jsonAnchor = trimmed.indexOf('[') >= 0 ? trimmed.indexOf('[') : trimmed.indexOf('{');
			const jsonPayload = jsonAnchor >= 0 ? trimmed.slice(jsonAnchor) : trimmed;
			try {
				resolve(JSON.parse(jsonPayload));
			} catch (err) {
				resolve(null);
			}
		});
	});

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

const serializeMovie = (movie, moodLabel, moodScore, ratingStats = {}) => ({
	id: movie.id,
	title: movie.title,
	overview: movie.description,
	poster_path: movie.poster,
	release_date: movie.releaseDate || movie.release_date || null,
	genres: normalizeGenres(movie.genres),
	moodTag: moodLabel,
	moodScore,
	rating: ratingStats.average ?? null,
	ratingCount: ratingStats.count ?? 0,
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
	rating: movie.vote_average ?? null,
	ratingCount: movie.vote_count ?? 0,
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
	const queryTokens = [moodConfig.label, normalizedMood, ...(MOOD_SYNONYM_TABLE[normalizedMood] || []), ...(focusGenres || []), textSample]
		.filter(Boolean)
		.join(' ');
	const seed = Number.isFinite(Number(refreshNonce)) ? Number(refreshNonce) : Date.now();

	let pythonMatches = [];
	let aiSource = 'heuristic';
	try {
		const result = await runPythonKeywordSearch({
			query: queryTokens,
			focusGenres,
			topN: limit * 4,
		});
		if (Array.isArray(result) && result.length) {
			pythonMatches = result;
			aiSource = 'python-keyword';
		}
	} catch (err) {
		pythonMatches = [];
	}

	const pythonScoreMap = new Map();
	const prioritizedIds = [];
	pythonMatches.forEach((item, index) => {
		const movieId = Number(item.movie_id ?? item.movieId ?? item.id);
		if (!movieId || pythonScoreMap.has(movieId)) return;
		const baseScore = typeof item.score === 'number' ? clamp01(item.score) : clamp01((pythonMatches.length - index) / pythonMatches.length);
		pythonScoreMap.set(movieId, baseScore);
		prioritizedIds.push(movieId);
	});

	let candidateMovies = [];
	if (prioritizedIds.length) {
		const prioritizedMovies = await Movie.findAll({ where: { id: prioritizedIds } });
		const byId = new Map(prioritizedMovies.map((movie) => [Number(movie.id), movie]));
		prioritizedIds.forEach((id) => {
			const matching = byId.get(id);
			if (matching) candidateMovies.push(matching);
		});
	}

	if (candidateMovies.length < limit * 2) {
		const fallbackBatch = await fetchLatestMovies(limit * 3);
		fallbackBatch.forEach((movie) => {
			const movieId = Number(movie.id);
			if (!movieId || pythonScoreMap.has(movieId)) return;
			pythonScoreMap.set(movieId, scoreMovieForMood(movie, focusGenres));
			candidateMovies.push(movie);
		});
	}

	if (!candidateMovies.length) {
		candidateMovies = await fetchLatestMovies(limit * 3);
		candidateMovies.forEach((movie) => {
			const movieId = Number(movie.id);
			if (!pythonScoreMap.has(movieId)) {
				pythonScoreMap.set(movieId, scoreMovieForMood(movie, focusGenres));
			}
		});
	}

	const uniqueCandidates = [];
	const seenIds = new Set();
	candidateMovies.forEach((movie) => {
		const movieId = Number(movie.id);
		if (!movieId || seenIds.has(movieId)) return;
		seenIds.add(movieId);
		uniqueCandidates.push(movie);
	});

	const ratingMap = await buildRatingMap(uniqueCandidates.map((movie) => movie.id));
	const scoredEntries = uniqueCandidates.map((movie) => {
		const movieId = Number(movie.id);
		const moodScoreBase = pythonScoreMap.get(movieId) ?? scoreMovieForMood(movie, focusGenres);
		const ratingStats = ratingMap.get(movieId) || { average: null, count: 0, normalized: 0, confidence: 0 };
		const ratingWeighted = ratingStats.normalized * (0.8 + ratingStats.confidence * 0.2);
		const blended = moodScoreBase * 0.55 + ratingWeighted * 0.35 + ratingStats.confidence * 0.1;
		const finalScore = jitterScore(clamp01(blended), seed + movieId);
		return { movie, finalScore, ratingStats };
	});

	scoredEntries.sort((a, b) => b.finalScore - a.finalScore);
	const recommendations = scoredEntries
		.slice(0, limit)
		.map(({ movie, finalScore, ratingStats }) => serializeMovie(movie, moodConfig.label, finalScore, ratingStats));

	const selectedIds = new Set(recommendations.map((entry) => entry.id));
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
			source: tmdbUsed ? (recommendations.length ? 'local-db+tmdb' : 'tmdb') : aiSource,
			totalMoviesScored: scoredEntries.length,
			refreshNonce: refreshNonce ?? null,
			aiModule: aiSource,
			ratingsApplied: true,
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
