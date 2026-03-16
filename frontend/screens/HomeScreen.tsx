import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  addToWatchlist,
  fetchMoodRecommendations,
  fetchTmdbTrendingMovies,
  fetchWatchlist,
  removeFromWatchlist,
  type MoodRecommendation,
  type MoodRecommendationResponse,
  type WatchlistEntry,
  type WatchlistMoviePayload,
} from '@/services/api';

type TmdbMovie = {
  id: number;
  title: string;
  poster_path?: string | null;
  release_date?: string | null;
};

type TmdbResponse = {
  results: TmdbMovie[];
  page?: number;
  total_pages?: number;
};

type MoodMovie = MoodRecommendation & {
  id: number | string;
  title: string;
  poster_path?: string | null;
  release_date?: string | null;
  rating?: number | null;
  ratingCount?: number;
};

type MoodPreset = {
  id: string;
  label: string;
  description: string;
  genres: string[];
  accent: string;
  keywords: string[];
};

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TRENDING_CARD_WIDTH = 140;
const RECOMMENDATION_CARD_WIDTH = 150;
const HORIZONTAL_CARD_GAP = 12;
const TRENDING_SNAP_INTERVAL = TRENDING_CARD_WIDTH + HORIZONTAL_CARD_GAP;
const RECOMMENDATION_SNAP_INTERVAL = RECOMMENDATION_CARD_WIDTH + HORIZONTAL_CARD_GAP;

const resolvePosterUri = (uri?: string | null) => {
  if (!uri) return null;
  if (/^https?:\/\//i.test(uri)) {
    return uri;
  }
  if (uri.startsWith('/')) {
    return `${TMDB_IMAGE_BASE}${uri}`;
  }
  return `${TMDB_IMAGE_BASE}/${uri}`;
};

const resolveNumericId = (value: number | string | null | undefined) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toWatchlistPayloadFromMoodMovie = (movie: MoodMovie) => ({
  title: movie.title,
  overview: (movie as { overview?: string; description?: string }).overview ??
    (movie as { description?: string }).description ??
    null,
  poster_path: movie.poster_path ?? (movie as { poster?: string }).poster ?? null,
  release_date:
    movie.release_date ?? (movie as { releaseDate?: string | null }).releaseDate ?? null,
  genres: Array.isArray(movie.genres) ? movie.genres : undefined,
});

const toWatchlistPayloadFromTmdbMovie = (movie: TmdbMovie) => ({
  title: movie.title,
  poster_path: movie.poster_path ?? null,
  release_date: movie.release_date ?? null,
});

const MOOD_PRESETS: MoodPreset[] = [
  {
    id: 'happy',
    label: 'Happy',
    description: 'Feel-good adventures',
    genres: ['Comedy', 'Adventure', 'Animation'],
    accent: '#FFC107',
    keywords: ['happy', 'joy', 'celebrate', 'ecstatic', 'optimistic'],
  },
  {
    id: 'excited',
    label: 'Excited',
    description: 'High-energy crowd pleasers',
    genres: ['Action', 'Adventure', 'Music'],
    accent: '#9C27B0',
    keywords: ['excited', 'pumped', 'thrilled', 'energetic', 'party'],
  },
  {
    id: 'calm',
    label: 'Calm',
    description: 'Cozy slow stories',
    genres: ['Drama', 'Slice of life'],
    accent: '#00BCD4',
    keywords: ['calm', 'peaceful', 'relaxed', 'chill', 'serene'],
  },
  {
    id: 'romantic',
    label: 'Romantic',
    description: 'Heartfelt connections',
    genres: ['Romance', 'Drama'],
    accent: '#FF6B9D',
    keywords: ['romantic', 'love', 'date', 'affection', 'caring'],
  },
  {
    id: 'sad',
    label: 'Blue',
    description: 'Comforting narratives',
    genres: ['Romance', 'Drama'],
    accent: '#3F51B5',
    keywords: ['sad', 'down', 'lonely', 'blue', 'upset'],
  },
  {
    id: 'stressed',
    label: 'Stressed',
    description: 'Light escape picks',
    genres: ['Animation', 'Family', 'Comedy'],
    accent: '#FF5722',
    keywords: ['stressed', 'overwhelmed', 'tired', 'burned out', 'drained'],
  },
  {
    id: 'angry',
    label: 'Angry',
    description: 'Cathartic releases',
    genres: ['Thriller', 'Crime', 'Action'],
    accent: '#C62828',
    keywords: ['angry', 'mad', 'furious', 'frustrated', 'rage'],
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'High-energy thrills',
    genres: ['Action', 'Sci-Fi'],
    accent: '#1565C0',
    keywords: ['bold', 'fearless', 'hyped', 'adrenaline', 'charged'],
  },
];

const DEFAULT_MOOD_ID = MOOD_PRESETS[0].id;

const MOOD_SYNONYM_TABLE: Record<string, string[]> = {
  happy: ['happy', 'joyful', 'glad', 'optimistic', 'sunny', 'cheerful', 'delighted'],
  excited: ['excited', 'pumped', 'thrilled', 'energetic', 'wired', 'party', 'amped'],
  calm: ['calm', 'peaceful', 'relaxed', 'serene', 'tranquil', 'zen', 'mellow'],
  romantic: ['romantic', 'love', 'lovey', 'affection', 'date', 'crush', 'heart'],
  sad: ['sad', 'blue', 'down', 'lonely', 'melancholy', 'heartbroken'],
  stressed: ['stressed', 'overwhelmed', 'anxious', 'drained', 'burned', 'frazzled'],
  angry: ['angry', 'mad', 'furious', 'rage', 'annoyed', 'irritated'],
  bold: ['bold', 'fearless', 'brave', 'daring', 'adrenaline'],
};

const applyAlphaToHex = (hex: string, alpha = 0.18) => {
  if (!hex) return hex;
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  if (normalized.length !== 6) return hex;
  const boundedAlpha = Math.min(Math.max(alpha, 0), 1);
  const alphaHex = Math.round(boundedAlpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${normalized}${alphaHex}`;
};

const cleanMoodText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeRecommendationResponse = (payload: MoodRecommendationResponse): MoodMovie[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload as MoodMovie[];
  }
  if (Array.isArray(payload.recommendations)) {
    return payload.recommendations as MoodMovie[];
  }
  if (Array.isArray(payload.movies)) {
    return payload.movies as MoodMovie[];
  }
  if (Array.isArray(payload.results)) {
    return payload.results as MoodMovie[];
  }
  return [];
};

const detectMoodFromText = (text: string) => {
  const normalized = cleanMoodText(text);
  if (!normalized) return null;
  return (
    Object.entries(MOOD_SYNONYM_TABLE).find(([, synonyms]) =>
      synonyms.some((keyword) => normalized.includes(keyword))
    )?.[0] ?? null
  );
};

type PosterProps = {
  uri?: string | null;
  title: string;
  watchlisted?: boolean;
  toggleBusy?: boolean;
  onToggleWatchlist?: (() => void) | null;
  fallbackTextColor?: string;
};

const Poster = ({ uri, title, watchlisted, toggleBusy, onToggleWatchlist, fallbackTextColor }: PosterProps) => {
  const [failed, setFailed] = useState(false);
  const resolvedUri = useMemo(() => resolvePosterUri(uri), [uri]);
  const showToggle = typeof onToggleWatchlist === 'function';

  return (
    <View style={styles.posterWrapper}>
      {resolvedUri && !failed ? (
        <Image source={{ uri: resolvedUri }} style={styles.poster} onError={() => setFailed(true)} />
      ) : (
        <View style={[styles.poster, styles.posterFallback]}>
          <Text style={[styles.posterFallbackText, fallbackTextColor ? { color: fallbackTextColor } : null]}>{title?.slice(0, 2).toUpperCase()}</Text>
        </View>
      )}
      {showToggle ? (
        <TouchableOpacity
          style={[
            styles.watchlistToggle,
            toggleBusy && styles.watchlistToggleDisabled,
          ]}
          onPress={onToggleWatchlist ?? undefined}
          activeOpacity={0.85}
          disabled={toggleBusy}
        >
          <Ionicons
            name="heart-outline"
            size={20}
            color={watchlisted ? '#0d6efd' : '#ffffff'}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const HomeScreen = () => {
  const { user } = useAuth();
  const { darkMode, toggleTheme } = useTheme();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const binaryTextColor = colorScheme === 'dark' ? '#ffffff' : '#000000';
  const cardBackground = colorScheme === 'dark' ? '#1f1f1f' : '#f5f7fa';
  const surfaceBorder = colorScheme === 'dark' ? '#2a2a2a' : '#e2e8f0';
  const mutedText = colors.icon;
  const [selectedMood, setSelectedMood] = useState<string | null>(DEFAULT_MOOD_ID);
  const [detectedMood, setDetectedMood] = useState<string | null>(null);
  const [textMood, setTextMood] = useState('');
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [lastAnalyzedText, setLastAnalyzedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [movies, setMovies] = useState<TmdbMovie[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [recommendedMovies, setRecommendedMovies] = useState<MoodMovie[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [moodLimit, setMoodLimit] = useState(12);
  const [moodNonce, setMoodNonce] = useState(() => Date.now());
  const requestIdRef = useRef(0); // Prevents stale recommendation responses from winning race conditions.
  const [watchlistEntries, setWatchlistEntries] = useState<WatchlistEntry[]>([]);
  const [watchlistIds, setWatchlistIds] = useState<Set<number>>(new Set());
  const [watchlistBusyId, setWatchlistBusyId] = useState<number | null>(null);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);

  const loadPage = async (nextPage: number, replace = false) => {
    const data: TmdbResponse = await fetchTmdbTrendingMovies('week', nextPage);
    if (Array.isArray(data?.results)) {
      setMovies((prev) => {
        const nextList = replace ? data.results : [...prev, ...data.results];
        const seen = new Set<number>();
        // FlatList needs unique keys, so drop duplicate movie ids across pages.
        return nextList.filter((movie) => {
          if (seen.has(movie.id)) {
            return false;
          }
          seen.add(movie.id);
          return true;
        });
      });
      const totalPages = data?.total_pages ?? nextPage;
      setHasMore(nextPage < totalPages);
      setPage(nextPage);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        await loadPage(1, true);
        if (mounted) setError(null);
      } catch (err) {
        if (mounted) setError('Failed to load trending movies');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const updateWatchlistState = useCallback((entries: WatchlistEntry[]) => {
    setWatchlistEntries(entries);
    const ids = entries
      .map((entry) => Number(entry.movieId))
      .filter((id) => Number.isFinite(id)) as number[];
    setWatchlistIds(new Set(ids));
  }, []);

  const loadWatchlist = useCallback(async () => {
    if (!user?.id) {
      updateWatchlistState([]);
      setWatchlistError(null);
      return;
    }
    try {
      const entries = await fetchWatchlist(user.id);
      updateWatchlistState(Array.isArray(entries) ? entries : []);
      setWatchlistError(null);
    } catch (err: any) {
      const message = err?.response?.data?.error ?? err?.message ?? 'Failed to load watchlist';
      setWatchlistError(message);
    }
  }, [updateWatchlistState, user?.id]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  const resolvedMood = selectedMood ?? detectedMood ?? null;
  const resolvedMoodDetails = useMemo(
    () => (resolvedMood ? MOOD_PRESETS.find((preset) => preset.id === resolvedMood) ?? null : null),
    [resolvedMood]
  );

  const loadMoodRecommendations = useCallback(
    async (moodId: string, origin: 'preset' | 'text' = 'preset') => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      setRecommendationsLoading(true);
      setRecommendationsError(null);
      try {
        const payload = {
          mood: moodId,
          limit: moodLimit,
          textSample: origin === 'text' ? lastAnalyzedText || textMood : undefined,
          fallbackGenres: resolvedMoodDetails?.genres,
          refreshNonce: moodNonce,
        };
        const response = await fetchMoodRecommendations(payload);
        if (requestId !== requestIdRef.current) return;
        setRecommendedMovies(normalizeRecommendationResponse(response));
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        const reason = err instanceof Error ? err.message : 'Unknown error';
        console.warn('[MoodRecommendations] request failed:', reason);
        setRecommendationsError(`Unable to load recommendations (${reason}).`);
      } finally {
        if (requestId === requestIdRef.current) {
          setRecommendationsLoading(false);
        }
      }
    },
    [lastAnalyzedText, textMood, resolvedMoodDetails, moodLimit, moodNonce]
  );

  useEffect(() => {
    if (!resolvedMood) {
      setRecommendedMovies([]);
      return;
    }
    loadMoodRecommendations(resolvedMood, selectedMood ? 'preset' : 'text');
  }, [resolvedMood, selectedMood, loadMoodRecommendations]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await loadPage(1, true);
      setError(null);
    } catch (err) {
      setError('Failed to refresh trending movies');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      await loadPage(page + 1);
    } catch (err) {
      setError('Failed to load more trending movies');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMoodSelect = (moodId: string) => {
    setSelectedMood(moodId);
    setDetectedMood(null);
    setAnalysisMessage(null);
    setLastAnalyzedText('');
    setMoodNonce(Date.now());
  };

  const handleAnalyzeText = () => {
    const candidate = textMood.trim();
    if (!candidate) {
      setAnalysisMessage('Describe how you feel to analyze your mood.');
      setDetectedMood(null);
      setSelectedMood(null);
      setLastAnalyzedText('');
      return;
    }
    const inferredMood = detectMoodFromText(candidate);
    setLastAnalyzedText(candidate);
    if (inferredMood) {
      setDetectedMood(inferredMood);
      setSelectedMood(null);
      const preset = MOOD_PRESETS.find((item) => item.id === inferredMood);
      setAnalysisMessage(
        preset ? `Detected a ${preset.label.toLowerCase()} mood from your text.` : 'Mood detected.'
      );
      setMoodNonce(Date.now());
    } else {
      setAnalysisMessage('Could not map that text to a mood. Try a preset.');
      setDetectedMood(null);
    }
  };

  const handleMoodRefresh = () => {
    setMoodNonce(Date.now());
  };

  const handleToggleMorePicks = () => {
    setMoodLimit((prev) => {
      const next = prev >= 20 ? 12 : 24;
      return next;
    });
    setMoodNonce(Date.now());
  };

  const handlePullRefresh = async () => {
    setRefreshing(true);
    try {
      await handleRefresh();
      if (resolvedMood) {
        await loadMoodRecommendations(resolvedMood, selectedMood ? 'preset' : 'text');
      }
      await loadWatchlist();
    } catch (err) {
      // errors handled inside individual loaders
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleWatchlist = useCallback(
    async (movieId: number | null, metadata?: WatchlistMoviePayload) => {
      if (!movieId || !Number.isFinite(movieId)) return;
      if (!user?.id) {
        Alert.alert('Sign in required', 'Log in to manage your watchlist.');
        return;
      }
      if (watchlistBusyId === movieId) return;
      setWatchlistBusyId(movieId);
      try {
        const existing = watchlistEntries.find((entry) => Number(entry.movieId) === movieId);
        if (existing) {
          await removeFromWatchlist(existing.id);
          setWatchlistEntries((prev) => prev.filter((entry) => entry.id !== existing.id));
          setWatchlistIds((prev) => {
            const next = new Set(prev);
            next.delete(movieId);
            return next;
          });
        } else {
          const created = await addToWatchlist(movieId, metadata);
          setWatchlistEntries((prev) => {
            if (prev.some((entry) => entry.id === created.id || Number(entry.movieId) === movieId)) {
              return prev;
            }
            return [...prev, created];
          });
          setWatchlistIds((prev) => {
            const next = new Set(prev);
            next.add(movieId);
            return next;
          });
        }
        loadWatchlist().catch(() => undefined);
      } catch (err: any) {
        const message = err?.response?.data?.error ?? err?.message ?? 'Unable to update watchlist';
        Alert.alert('Watchlist', message);
      } finally {
        setWatchlistBusyId(null);
      }
    },
    [user?.id, watchlistBusyId, watchlistEntries, loadWatchlist]
  );

  const renderRecommendationCard = (item: MoodMovie) => {
    const numericId = resolveNumericId(item.id as number | string | null | undefined);
    const isSaved = numericId ? watchlistIds.has(numericId) : false;
    return (
      <View
        key={`mood-${item.id}`}
        style={[styles.recoCard, { backgroundColor: colorScheme === 'dark' ? '#151718' : '#ffffff' }]}
      >
        <Poster
          uri={item.poster_path}
          title={item.title}
          watchlisted={isSaved}
          toggleBusy={numericId !== null && watchlistBusyId === numericId}
          fallbackTextColor={binaryTextColor}
          onToggleWatchlist={
            numericId !== null
              ? () => handleToggleWatchlist(numericId, toWatchlistPayloadFromMoodMovie(item))
              : null
          }
        />
        <Text style={[styles.movieTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        {item.genres && item.genres.length > 0 ? (
          <Text style={[styles.recoMeta, { color: mutedText }]} numberOfLines={1}>
            {item.genres.slice(0, 2).join(' • ')}
          </Text>
        ) : null}
        {item.moodTag || typeof item.moodScore === 'number' ? (
          <Text style={[styles.recoMeta, { color: mutedText }]} numberOfLines={1}>
            {item.moodTag ? `${item.moodTag}` : null}
            {item.moodTag && typeof item.moodScore === 'number' ? ' · ' : ''}
            {typeof item.moodScore === 'number' ? `Match ${(item.moodScore * 100).toFixed(0)}%` : ''}
          </Text>
        ) : null}
        {typeof item.rating === 'number' ? (
          <Text style={[styles.recoMeta, { color: colors.tint }]} numberOfLines={1}>
            ★ {item.rating.toFixed(1)} {item.ratingCount ? `· ${item.ratingCount} reviews` : ''}
          </Text>
        ) : null}
        {item.release_date ? (
          <Text style={[styles.recoMeta, { color: mutedText }]} numberOfLines={1}>
            {new Date(item.release_date).getFullYear()}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handlePullRefresh}
            tintColor={colors.tint}
            colors={[colors.tint]}
          />
        }
      >
        <View style={styles.brandWrap}>
          <View style={styles.brandHeader}>
            <Text style={[styles.brandTitle, { color: colors.text }]}>FlickX</Text>
            <TouchableOpacity
              style={[
                styles.themeToggle,
                {
                  borderColor: surfaceBorder,
                  backgroundColor: colorScheme === 'dark' ? '#1c1c1c' : '#ffffff',
                },
              ]}
              onPress={toggleTheme}
              accessibilityRole="button"
              accessibilityLabel="Toggle dark mode"
              activeOpacity={0.85}
            >
              <Ionicons name={darkMode ? 'moon' : 'sunny'} size={16} color={colors.tint} />
              <Text style={[styles.themeToggleText, { color: colors.text }]}>
                {darkMode ? 'Dark on' : 'Dark off'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.heroText, { color: mutedText }]}>Movies that match your mood.</Text>
        </View>

        <View
          style={[
            styles.sectionCard,
            { backgroundColor: cardBackground, borderColor: surfaceBorder },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>How are you feeling?</Text>
          <Text style={[styles.sectionSubtitle, { color: mutedText }]}>Pick a mood or describe it to see personalized picks.</Text>
          <View style={styles.moodGrid}>
            {MOOD_PRESETS.map((preset) => {
              const isActive = preset.id === resolvedMood;
              const chipBackground = isActive
                ? preset.accent
                : applyAlphaToHex(
                    preset.accent,
                    colorScheme === 'dark' ? 0.32 : 0.16
                  );
              const chipLabelColor = isActive ? binaryTextColor : colors.text;
              const chipDescriptionColor = isActive ? 'rgba(255,255,255,0.85)' : mutedText;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.moodChip,
                    {
                      borderColor: preset.accent,
                      backgroundColor: chipBackground,
                    },
                  ]}
                  onPress={() => handleMoodSelect(preset.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipLabel, { color: chipLabelColor }]}>{preset.label}</Text>
                  <Text style={[styles.chipGenres, { color: chipDescriptionColor }]} numberOfLines={1}>
                    {preset.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[styles.textInputRow, { borderColor: surfaceBorder }]}>
            <TextInput
              value={textMood}
              onChangeText={setTextMood}
              placeholder="Type a short mood description"
              placeholderTextColor={mutedText}
              style={[styles.textInput, { color: colors.text }]}
              multiline
            />
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.tint }]}
              onPress={handleAnalyzeText}
              activeOpacity={0.85}
            >
              <Text style={[styles.primaryButtonText, { color: binaryTextColor }]}>Analyze</Text>
            </TouchableOpacity>
          </View>
          {analysisMessage ? (
            <Text style={[styles.analysisText, { color: mutedText }]}>{analysisMessage}</Text>
          ) : null}
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.headerLeft}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>AI Mood Picks</Text>
            <Text style={[styles.sectionSubtitle, { color: mutedText }]}>Based on {resolvedMoodDetails?.label ?? 'your mood'} mood.</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => resolvedMood && handleMoodRefresh()}
              disabled={!resolvedMood || recommendationsLoading}
            >
              <Text
                style={[
                  styles.linkButton,
                  {
                    color: colors.tint,
                    opacity: !resolvedMood || recommendationsLoading ? 0.5 : 1,
                  },
                ]}
              >
                Refresh
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleToggleMorePicks}>
              <Text style={[styles.linkButton, { color: colors.tint }]}>
                {moodLimit > 15 ? 'Fewer' : 'More'} picks
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.recommendationsWrapper}>
          {watchlistError ? (
            <Text style={[styles.watchlistNotice, { color: '#d7263d' }]}>{watchlistError}</Text>
          ) : null}
          {recommendationsLoading ? (
            <ActivityIndicator color={colors.tint} />
          ) : recommendationsError ? (
            <Text style={[styles.emptyText, { color: mutedText }]}>{recommendationsError}</Text>
          ) : recommendedMovies.length === 0 ? (
            <Text style={[styles.emptyText, { color: mutedText }]}>Select or describe a mood, then pull down to refresh once the server is running.</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToAlignment="start"
              snapToInterval={RECOMMENDATION_SNAP_INTERVAL}
              disableIntervalMomentum
              contentContainerStyle={styles.recommendationsList}
            >
              {recommendedMovies.map((item) => renderRecommendationCard(item))}
            </ScrollView>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.headerLeft}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Trending Now</Text>
            <Text style={[styles.sectionSubtitle, { color: mutedText }]}>Updated hourly from TMDB.</Text>
          </View>
          <TouchableOpacity onPress={handleRefresh} disabled={loading}>
            <Text
              style={[
                styles.linkButton,
                {
                  color: colors.tint,
                  opacity: loading ? 0.5 : 1,
                },
              ]}
            >
              {loading ? 'Loading...' : 'Reload'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.trendingSection}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.tint} />
            </View>
          ) : (
            <FlatList
              data={movies}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToAlignment="start"
              snapToInterval={TRENDING_SNAP_INTERVAL}
              disableIntervalMomentum
              removeClippedSubviews={false}
              contentContainerStyle={styles.listContent}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.6}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={[styles.emptyText, { color: mutedText }]}>
                    {error ?? 'No trending movies found'}
                  </Text>
                </View>
              }
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.footer}>
                    <ActivityIndicator color={colors.tint} />
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                const numericId = resolveNumericId(item.id);
                const isSaved = numericId !== null ? watchlistIds.has(numericId) : false;
                return (
                  <View style={styles.card}>
                    <Poster
                      uri={item.poster_path}
                      title={item.title}
                      watchlisted={isSaved}
                      toggleBusy={numericId !== null && watchlistBusyId === numericId}
                      fallbackTextColor={binaryTextColor}
                      onToggleWatchlist={
                        numericId !== null
                          ? () => handleToggleWatchlist(numericId, toWatchlistPayloadFromTmdbMovie(item))
                          : null
                      }
                    />
                    <Text style={[styles.movieTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[styles.movieMeta, { color: mutedText }]} numberOfLines={1}>
                      {item.release_date ? new Date(item.release_date).getFullYear() : '—'}
                    </Text>
                  </View>
                );
              }}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  brandWrap: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 12 },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandTitle: { fontSize: 28, fontWeight: '800' },
  heroText: { marginTop: 4, fontSize: 14 },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  themeToggleText: { fontSize: 12, fontWeight: '600', marginLeft: 6 },
  center: { alignItems: 'center', justifyContent: 'center', minHeight: 140 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  card: { width: TRENDING_CARD_WIDTH, marginRight: HORIZONTAL_CARD_GAP },
  posterWrapper: {
    width: TRENDING_CARD_WIDTH,
    height: 210,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  poster: { width: TRENDING_CARD_WIDTH, height: 210, borderRadius: 16, backgroundColor: '#1f1f1f' },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  posterFallbackText: { fontSize: 22, fontWeight: '700' },
  watchlistToggle: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchlistToggleDisabled: { opacity: 0.6 },
  movieTitle: { marginTop: 10, fontSize: 14, fontWeight: '600' },
  movieMeta: { marginTop: 4, fontSize: 12 },
  footer: { paddingHorizontal: 16, paddingVertical: 12 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  sectionCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionSubtitle: { fontSize: 13, marginTop: 4 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16 },
  moodChip: {
    flexBasis: '48%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  chipLabel: { fontSize: 14, fontWeight: '700' },
  chipGenres: { marginTop: 4, fontSize: 12 },
  textInputRow: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  textInput: { minHeight: 60, fontSize: 14, textAlignVertical: 'top' },
  primaryButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  primaryButtonText: { fontWeight: '700' },
  analysisText: { marginTop: 10, fontSize: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerLeft: { flex: 1, paddingRight: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', columnGap: 12 },
  linkButton: { fontSize: 13, fontWeight: '600' },
  recommendationsWrapper: { minHeight: 240, paddingBottom: 24, paddingHorizontal: 16 },
  recommendationsList: { paddingHorizontal: 16 },
  recoCard: {
    width: RECOMMENDATION_CARD_WIDTH,
    marginRight: HORIZONTAL_CARD_GAP,
    padding: 12,
    borderRadius: 18,
  },
  recoMeta: { marginTop: 4, fontSize: 12 },
  trendingSection: { minHeight: 260 },
  watchlistNotice: { fontSize: 12, marginBottom: 8, textAlign: 'center' },
});

export default HomeScreen;
