import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
};

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

const HomeScreen = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [loading, setLoading] = useState(true);
  const [movies, setMovies] = useState<TmdbMovie[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data: TmdbResponse = await fetchTmdbTrendingMovies('week');
        if (mounted && Array.isArray(data?.results)) {
          setMovies(data.results);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const headerSubtitle = useMemo(() => {
    if (!movies.length) return 'Discover trending movies';
    return `${movies.length} movies trending now`;
  }, [movies.length]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Trending Movies</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>{headerSubtitle}</Text>
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
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.poster_path ? (
                <Image source={{ uri: `${TMDB_IMAGE_BASE}${item.poster_path}` }} style={styles.poster} />
              ) : (
                <View style={[styles.poster, styles.posterFallback]}>
                  <Text style={[styles.posterFallbackText, { color: colors.text }]}>
                    {item.title?.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { marginTop: 6, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { width: 140, marginHorizontal: 8 },
  poster: { width: 140, height: 210, borderRadius: 16, backgroundColor: '#1f1f1f' },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  posterFallbackText: { fontSize: 22, fontWeight: '700' },
  movieTitle: { marginTop: 10, fontSize: 14, fontWeight: '600' },
  movieMeta: { marginTop: 4, fontSize: 12 },
});

export default HomeScreen;
