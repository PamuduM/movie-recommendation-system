// AI Recommendation Service (enhanced with Python hybrid model)
const { Op, fn, col } = require('sequelize');
const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { randomUUID } = require('crypto');
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
const AI_SCRIPT_AVAILABLE = fs.existsSync(PYTHON_SCRIPT_PATH);

const TMDB_GENRE_LABELS = {
	28: 'Action',
	12: 'Adventure',
	16: 'Animation',
	35: 'Comedy',
	80: 'Crime',
	99: 'Documentary',
	18: 'Drama',
	10751: 'Family',
	14: 'Fantasy',
	36: 'History',
	27: 'Horror',
	10402: 'Music',
	9648: 'Mystery',
	10749: 'Romance',
	878: 'Sci-Fi',
	10770: 'TV Movie',
	53: 'Thriller',
	10752: 'War',
	37: 'Western',
};

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

const seededRandom = (seed = 1) => {
	const x = Math.sin(seed) * 10000;
	return x - Math.floor(x);
};

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

const runPythonKeywordSearch = async ({ query, focusGenres = [], topN = 40, dataset = null } = {}) => {
	if (!AI_SCRIPT_AVAILABLE || !query?.trim() || PYTHON_COMMANDS.length === 0) return null;
	let tempFilePath = null;
	const args = [
		PYTHON_SCRIPT_PATH,
		'--mode',
		'keyword',
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
	try {
		if (Array.isArray(dataset) && dataset.length > 0) {
			tempFilePath = path.join(os.tmpdir(), `flickx-mood-${randomUUID()}.json`);
			await fs.promises.writeFile(tempFilePath, JSON.stringify({ movies: dataset }), 'utf8');
			args.push('--input-json', tempFilePath);
		} else if (SQLITE_STORAGE_PATH) {
			args.push('--db', SQLITE_STORAGE_PATH);
		} else {
			return null;
		}
		for (const command of PYTHON_COMMANDS) {
			if (!command) continue;
			const payload = await spawnPython(command, args);
			if (payload) return payload;
		}
		return null;
	} finally {
		if (tempFilePath) {
			fs.promises.unlink(tempFilePath).catch(() => undefined);
		}
	}
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

const normalizeTmdbGenres = (genreIds = []) =>
	Array.isArray(genreIds)
		? genreIds
			.map((id) => TMDB_GENRE_LABELS[id] || `Genre-${id}`)
			.filter(Boolean)
		: [];

const buildPythonDataset = (localMovies = [], tmdbMovies = []) => {
	const map = new Map();
	const pushMovie = (movie) => {
		if (!movie || !movie.id) return;
		const numericId = Number(movie.id);
		if (!Number.isFinite(numericId)) return;
		if (map.has(numericId)) return;
		map.set(numericId, {
			id: numericId,
			title: movie.title || movie.name || 'Untitled',
			description: movie.description || movie.overview || '',
			genres: Array.isArray(movie.genres) ? movie.genres : normalizeTmdbGenres(movie.genre_ids),
			releaseDate: movie.releaseDate || movie.release_date || movie.first_air_date || null,
		});
	};
	localMovies.forEach((movie) => {
		pushMovie({
			id: Number(movie.id),
			title: movie.title,
			description: movie.description,
			genres: normalizeGenres(movie.genres),
			releaseDate: movie.releaseDate,
		});
	});
	tmdbMovies.forEach((movie) => pushMovie(movie));
	return Array.from(map.values());
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
	const bias = Math.sin(seedFactor * 0.017 + base * 11) * 0.08;
	const spread = (seededRandom(seedFactor * 0.001 + base) - 0.5) * 0.35;
	const noisy = base + bias + spread;
	if (Number.isNaN(noisy)) return base;
	return clamp01(noisy);
};

const seededShuffle = (items = [], seed = 1) => {
	const list = [...items];
	for (let index = list.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(seededRandom(seed + index * 1.618) * (index + 1));
		const current = list[index];
		list[index] = list[swapIndex];
		list[swapIndex] = current;
	}
	return list;
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

	const localPool = await fetchLatestMovies(Math.max(limit * 6, 60));
	const tmdbRawPool = tmdbClient
		? await fetchTmdbForMood(focusGenres, Math.max(limit * 5, 40), moodConfig.label, { raw: true })
		: [];
	const tmdbPool = tmdbRawPool
		.map((movie) => ({
			id: Number(movie.id),
		title: movie.title || movie.name || 'Untitled',
		overview: movie.overview || '',
		poster_path: movie.poster_path || null,
		release_date: movie.release_date || movie.first_air_date || null,
		genres: normalizeTmdbGenres(movie.genre_ids),
		vote_average: movie.vote_average ?? null,
		vote_count: movie.vote_count ?? null,
		genre_ids: movie.genre_ids || [],
		}))
		.filter((movie) => Number.isFinite(movie.id));

	let pythonMatches = [];
	let aiSource = 'heuristic';
	try {
		const dataset = buildPythonDataset(localPool, tmdbPool);
		const result = await runPythonKeywordSearch({
			query: queryTokens,
			focusGenres,
			topN: limit * 6,
			dataset,
		});
		if (Array.isArray(result) && result.length) {
			pythonMatches = result;
			aiSource = tmdbPool.length ? 'python-keyword+tmdb' : 'python-keyword';
		}
	} catch (err) {
		pythonMatches = [];
	}

	const pythonScoreMap = new Map();
	pythonMatches.forEach((item, index) => {
		const movieId = Number(item.movie_id ?? item.movieId ?? item.id);
		if (!movieId || pythonScoreMap.has(movieId)) return;
		const baseScore = typeof item.score === 'number' ? clamp01(item.score) : clamp01((pythonMatches.length - index) / pythonMatches.length);
		pythonScoreMap.set(movieId, baseScore);
	});

	const candidateMap = new Map();
	const combinedCandidates = [];
	const addCandidate = (entry) => {
		const movieId = Number(entry.id);
		if (!Number.isFinite(movieId) || candidateMap.has(movieId)) return;
		candidateMap.set(movieId, entry);
		combinedCandidates.push(entry);
	};

	localPool.forEach((movie) => addCandidate({ type: 'local', id: Number(movie.id), movie }));
	tmdbPool.forEach((movie) => addCandidate({ type: 'tmdb', id: Number(movie.id), movie }));

	if (!combinedCandidates.length) {
		const fallbackBatch = await fetchLatestMovies(limit * 3);
		fallbackBatch.forEach((movie) => addCandidate({ type: 'local', id: Number(movie.id), movie }));
	}

	const ratingMap = await buildRatingMap(localPool.map((movie) => movie.id));
	const scoredEntries = combinedCandidates.map((entry) => {
		const movieId = Number(entry.id);
		const baseMovie = entry.type === 'local' ? entry.movie : { genres: entry.movie.genres };
		const moodScoreBase = pythonScoreMap.get(movieId) ?? scoreMovieForMood(baseMovie, focusGenres);
		let ratingStats;
		if (entry.type === 'local') {
			ratingStats = ratingMap.get(movieId) || { average: null, count: 0, normalized: 0, confidence: 0 };
		} else {
			const avg = Number(entry.movie.vote_average) || 0;
			const count = Number(entry.movie.vote_count) || 0;
			ratingStats = {
				average: count ? Number(avg.toFixed(1)) : null,
				count,
				normalized: count ? clamp01(avg / 10) : 0,
				confidence: count ? clamp01(Math.log10(1 + count) / 3) : 0,
			};
		}
		const ratingWeighted = ratingStats.normalized * (0.8 + ratingStats.confidence * 0.2);
		const blended = moodScoreBase * 0.55 + ratingWeighted * 0.35 + ratingStats.confidence * 0.1;
		const finalScore = jitterScore(clamp01(blended), seed + movieId);
		return { entry, blendedScore: clamp01(blended), finalScore, ratingStats };
	});

	scoredEntries.sort((a, b) => b.blendedScore - a.blendedScore || b.finalScore - a.finalScore);
	const selectionPoolSize = Math.min(
		scoredEntries.length,
		Math.max(limit * 3, limit + 8)
	);
	const selectionPool = scoredEntries.slice(0, selectionPoolSize);
	const remainingPool = scoredEntries.slice(selectionPoolSize);
	const maxOffset = Math.max(selectionPool.length - limit, 0);
	const startOffset = maxOffset
		? Math.floor(seededRandom(seed * 0.013 + selectionPool.length) * (maxOffset + 1))
		: 0;
	const rotatedWindow = selectionPool.slice(startOffset, startOffset + limit);
	const prioritizedEntries = [
		...seededShuffle(rotatedWindow, seed + 97),
		...selectionPool.slice(0, startOffset),
		...selectionPool.slice(startOffset + rotatedWindow.length),
		...remainingPool,
	];
	const recommendations = [];
	const selectedIds = new Set();
	prioritizedEntries.forEach(({ entry, finalScore, ratingStats }) => {
		if (recommendations.length >= limit) return;
		if (selectedIds.has(entry.id)) return;
		selectedIds.add(entry.id);
		if (entry.type === 'local') {
			recommendations.push(serializeMovie(entry.movie, moodConfig.label, finalScore, ratingStats));
		} else {
			if (ratingStats.average) entry.movie.vote_average = ratingStats.average;
			if (ratingStats.count) entry.movie.vote_count = ratingStats.count;
			recommendations.push(serializeTmdbMovie(entry.movie, moodConfig.label, finalScore));
		}
	});

	let tmdbUsed = recommendations.some((item) => !candidateMap.get(item.id)?.type || candidateMap.get(item.id)?.type === 'tmdb');
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
			source: tmdbUsed ? 'hybrid-local+tmdb' : aiSource,
			totalMoviesScored: scoredEntries.length,
			refreshNonce: refreshNonce ?? null,
			aiModule: aiSource,
			ratingsApplied: true,
		},
		recommendations,
	};
};

async function fetchTmdbForMood(focusGenres, limit, moodLabel, options = {}) {
	const { raw = false } = options;
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
		const sliced = results.slice(0, limit);
		if (raw) return sliced;
		return sliced.map((movie, index) =>
			serializeTmdbMovie(movie, moodLabel, useDiscover ? 0.6 - index * 0.02 : 0.4 - index * 0.01)
		);
	} catch (err) {
		return [];
	}
}
