import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchTmdbTrendingMovies } from '@/services/api';

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

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

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
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [movies, setMovies] = useState<TmdbMovie[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={styles.brandWrap}>
        <Text style={[styles.brandTitle, { color: colors.text }]}>FlickX</Text>
      </View>

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
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.6}
          refreshing={loading}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: colors.icon }]}>
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
              <Text style={[styles.movieMeta, { color: colors.icon }]} numberOfLines={1}>
                {item.release_date ? new Date(item.release_date).getFullYear() : '—'}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  brandWrap: { alignItems: 'center', paddingTop: 16, paddingBottom: 8 },
  brandTitle: { fontSize: 28, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { width: 140, marginHorizontal: 8 },
  poster: { width: 140, height: 210, borderRadius: 16, backgroundColor: '#1f1f1f' },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  posterFallbackText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  movieTitle: { marginTop: 10, fontSize: 14, fontWeight: '600' },
  movieMeta: { marginTop: 4, fontSize: 12 },
  footer: { paddingHorizontal: 16, paddingVertical: 12 },
  emptyText: { fontSize: 14 },
});

export default HomeScreen;
