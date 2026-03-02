import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  fetchMoodRecommendations,
  fetchTmdbTrendingMovies,
  type MoodRecommendation,
  type MoodRecommendationResponse,
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

const MOOD_PRESETS: MoodPreset[] = [
  {
    id: 'happy',
    label: 'Happy',
    description: 'Feel-good adventures',
    genres: ['Comedy', 'Adventure'],
    accent: '#f6a326',
    keywords: ['happy', 'joy', 'celebrate', 'excited', 'optimistic'],
  },
  {
    id: 'calm',
    label: 'Calm',
    description: 'Cozy slow stories',
    genres: ['Drama', 'Slice of life'],
    accent: '#4ab5cb',
    keywords: ['calm', 'peaceful', 'relaxed', 'chill', 'serene'],
  },
  {
    id: 'sad',
    label: 'Blue',
    description: 'Comforting narratives',
    genres: ['Romance', 'Drama'],
    accent: '#7a6ad8',
    keywords: ['sad', 'down', 'lonely', 'blue', 'upset'],
  },
  {
    id: 'stressed',
    label: 'Stressed',
    description: 'Light escape picks',
    genres: ['Animation', 'Family'],
    accent: '#ef5c4d',
    keywords: ['stressed', 'overwhelmed', 'tired', 'burned out', 'drained'],
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'High-energy thrills',
    genres: ['Action', 'Sci-Fi'],
    accent: '#2f95dc',
    keywords: ['bold', 'fearless', 'hyped', 'adrenaline', 'charged'],
  },
];

const DEFAULT_MOOD_ID = MOOD_PRESETS[0].id;

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
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  const preset = MOOD_PRESETS.find(({ keywords }) =>
    keywords.some((keyword) => normalized.includes(keyword))
  );
  if (preset) return preset.id;
  if (normalized.includes('angry') || normalized.includes('frustrated')) {
    return 'stressed';
  }
  if (normalized.includes('grateful')) {
    return 'happy';
  }
  if (normalized.includes('nostalgic') || normalized.includes('reflective')) {
    return 'calm';
  }
  return null;
};

const Poster = ({ uri, title }: { uri?: string | null; title: string }) => {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View style={[styles.poster, styles.posterFallback]}>
        <Text style={[styles.posterFallbackText]}>{title?.slice(0, 2).toUpperCase()}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: `${TMDB_IMAGE_BASE}${uri}` }}
      style={styles.poster}
      onError={() => setFailed(true)}
    />
  );
};

const HomeScreen = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
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
  const requestIdRef = useRef(0); // Prevents stale recommendation responses from winning race conditions.

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
          limit: 12,
          textSample: origin === 'text' ? lastAnalyzedText || textMood : undefined,
          fallbackGenres: resolvedMoodDetails?.genres,
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
    [lastAnalyzedText, textMood, resolvedMoodDetails]
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
    } else {
      setAnalysisMessage('Could not map that text to a mood. Try a preset.');
      setDetectedMood(null);
    }
  };

  const handlePullRefresh = async () => {
    setRefreshing(true);
    try {
      await handleRefresh();
      if (resolvedMood) {
        await loadMoodRecommendations(resolvedMood, selectedMood ? 'preset' : 'text');
      }
    } catch (err) {
      // errors handled inside individual loaders
    } finally {
      setRefreshing(false);
    }
  };

  const renderRecommendationCard = (item: MoodMovie) => (
    <View
      key={`mood-${item.id}`}
      style={[styles.recoCard, { backgroundColor: colorScheme === 'dark' ? '#151718' : '#ffffff' }]}
    >
      <Poster uri={item.poster_path} title={item.title} />
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
      {item.release_date ? (
        <Text style={[styles.recoMeta, { color: mutedText }]} numberOfLines={1}>
          {new Date(item.release_date).getFullYear()}
        </Text>
      ) : null}
    </View>
  );

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
          <Text style={[styles.brandTitle, { color: colors.text }]}>FlickX</Text>
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
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.moodChip,
                    {
                      borderColor: isActive ? preset.accent : surfaceBorder,
                      backgroundColor: colorScheme === 'dark' ? '#1c1c1c' : '#ffffff',
                    },
                  ]}
                  onPress={() => handleMoodSelect(preset.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipLabel, { color: colors.text }]}>{preset.label}</Text>
                  <Text style={[styles.chipGenres, { color: mutedText }]} numberOfLines={1}>
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
              <Text style={styles.primaryButtonText}>Analyze</Text>
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
          <TouchableOpacity
            onPress={() => resolvedMood && loadMoodRecommendations(resolvedMood, selectedMood ? 'preset' : 'text')}
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
        </View>

        <View style={styles.recommendationsWrapper}>
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
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Poster uri={item.poster_path} title={item.title} />
                  <Text style={[styles.movieTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.movieMeta, { color: mutedText }]} numberOfLines={1}>
                    {item.release_date ? new Date(item.release_date).getFullYear() : '—'}
                  </Text>
                </View>
              )}
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
  brandTitle: { fontSize: 28, fontWeight: '800' },
  heroText: { marginTop: 4, fontSize: 14 },
  center: { alignItems: 'center', justifyContent: 'center', minHeight: 140 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  card: { width: 140, marginHorizontal: 8 },
  poster: { width: 140, height: 210, borderRadius: 16, backgroundColor: '#1f1f1f' },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  posterFallbackText: { fontSize: 22, fontWeight: '700', color: '#fff' },
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
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  analysisText: { marginTop: 10, fontSize: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerLeft: { flex: 1, paddingRight: 12 },
  linkButton: { fontSize: 13, fontWeight: '600' },
  recommendationsWrapper: { minHeight: 240, paddingBottom: 24, paddingHorizontal: 16 },
  recommendationsList: { paddingHorizontal: 16 },
  recoCard: {
    width: 150,
    marginHorizontal: 8,
    padding: 12,
    borderRadius: 18,
  },
  recoMeta: { marginTop: 4, fontSize: 12 },
  trendingSection: { minHeight: 260 },
});

export default HomeScreen;
