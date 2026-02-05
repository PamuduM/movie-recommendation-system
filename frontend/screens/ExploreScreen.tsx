import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchTmdbDiscover, fetchTmdbGenres, searchTmdbMovies } from '@/services/api';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type TmdbMovie = {
  id: number;
  title: string;
  poster_path?: string | null;
  release_date?: string | null;
  genre_ids?: number[] | null;
};

type TmdbResponse = {
  results: TmdbMovie[];
};

type TmdbGenre = { id: number; name: string };

const SORT_OPTIONS = ['Popularity', 'Newest', 'Oldest', 'Title A–Z'];
const SORT_MAP: Record<string, string> = {
  Popularity: 'popularity.desc',
  Newest: 'primary_release_date.desc',
  Oldest: 'primary_release_date.asc',
  'Title A–Z': 'original_title.asc',
};

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

const Poster = ({ uri, title }: { uri?: string | null; title: string }) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!uri || failed) {
    return (
      <View style={[styles.rowPoster, styles.posterFallback]}>
        <Text style={[styles.posterFallbackText]}>{title?.slice(0, 2).toUpperCase()}</Text>
      </View>
    );
  }

  return (
    <View style={styles.posterStack}>
      <View style={[styles.rowPoster, styles.posterFallback]}>
        <Text style={[styles.posterFallbackText]}>{title?.slice(0, 2).toUpperCase()}</Text>
      </View>
      <Image
        source={{ uri: `${TMDB_IMAGE_BASE}${uri}` }}
        style={[styles.rowPoster, styles.posterImage, { opacity: loaded ? 1 : 0 }]}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </View>
  );
};

const ExploreScreen = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [loading, setLoading] = useState(true);
  const [movies, setMovies] = useState<TmdbMovie[]>([]);
  const [query, setQuery] = useState('');
  const [genres, setGenres] = useState<TmdbGenre[]>([]);
  const [genre, setGenre] = useState('All');
  const [year, setYear] = useState('All');
  const [sortBy, setSortBy] = useState('Popularity');

  useEffect(() => {
    let mounted = true;
    const loadGenres = async () => {
      try {
        const data = await fetchTmdbGenres();
        if (mounted && Array.isArray(data?.genres)) {
          setGenres(data.genres);
        }
      } catch (err) {
        setGenres([]);
      }
    };
    loadGenres();
    return () => {
      mounted = false;
    };
  }, []);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years = Array.from({ length: 50 }, (_, i) => String(current - i));
    return ['All', ...years];
  }, []);

  const genreOptions = useMemo(() => {
    const names = genres.map((g) => g.name);
    return ['All', ...names];
  }, [genres]);

  useEffect(() => {
    let mounted = true;
    const loadMovies = async () => {
      setLoading(true);
      try {
        if (query.trim()) {
          const data: TmdbResponse = await searchTmdbMovies(query.trim(), 1);
          if (mounted) setMovies(data?.results ?? []);
        } else {
          const genreId = genres.find((g) => g.name === genre)?.id;
          const data: TmdbResponse = await fetchTmdbDiscover({
            sort_by: SORT_MAP[sortBy],
            with_genres: genreId ? String(genreId) : undefined,
            primary_release_year: year !== 'All' ? year : undefined,
            page: 1,
          });
          if (mounted) setMovies(data?.results ?? []);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadMovies();
    return () => {
      mounted = false;
    };
  }, [query, genre, year, sortBy, genres]);

  const cycleValue = (list: string[], current: string, setter: (v: string) => void) => {
    const idx = list.indexOf(current);
    const next = list[(idx + 1) % list.length];
    setter(next);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={styles.pageIconRow}>
        <MaterialIcons size={24} name="search" color={colors.icon} />
      </View>

      <View style={[styles.searchBar, { borderColor: colors.icon }]}> 
        <MaterialIcons size={18} name="search" color={colors.icon} style={styles.searchIcon} />
        <TextInput
          placeholder="Search movies"
          placeholderTextColor={colors.icon}
          value={query}
          onChangeText={setQuery}
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>

      <View style={styles.filtersRow}>
        <Pressable
          onPress={() => cycleValue(yearOptions, year, setYear)}
          style={[styles.filterChip, { borderColor: colors.icon }]}
        >
          <Text style={[styles.filterLabel, { color: colors.text }]}>Year</Text>
          <Text style={[styles.filterValue, { color: colors.icon }]}>{year}</Text>
        </Pressable>

        <Pressable
          onPress={() => cycleValue(genreOptions, genre, setGenre)}
          style={[styles.filterChip, { borderColor: colors.icon }]}
        >
          <Text style={[styles.filterLabel, { color: colors.text }]}>Genre</Text>
          <Text style={[styles.filterValue, { color: colors.icon }]}>{genre}</Text>
        </Pressable>

        <Pressable
          onPress={() => cycleValue(SORT_OPTIONS, sortBy, setSortBy)}
          style={[styles.filterChip, { borderColor: colors.icon }]}
        >
          <Text style={[styles.filterLabel, { color: colors.text }]}>Sort By</Text>
          <Text style={[styles.filterValue, { color: colors.icon }]}>{sortBy}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.tint} />
        </View>
      ) : query.trim() ? (
        <FlatList
          data={movies}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.rowCard}>
              <Poster uri={item.poster_path} title={item.title} />
              <View style={styles.rowInfo}>
                <Text style={[styles.movieTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.movieMeta, { color: colors.icon }]}>
                  {item.release_date ? new Date(item.release_date).getFullYear() : '—'}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.icon }]}>No results found.</Text>
          }
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageIconRow: { alignItems: 'center', paddingTop: 12 },
  searchBar: {
    marginHorizontal: 20,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchIcon: { marginRight: 2 },
  searchInput: { fontSize: 16, marginLeft: 8, flex: 1 },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 12,
  },
  filterChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 4,
  },
  filterLabel: { fontSize: 12, fontWeight: '600' },
  filterValue: { marginTop: 4, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 32 },
  rowCard: { flexDirection: 'row', marginBottom: 16 },
  rowPoster: { width: 64, height: 96, borderRadius: 12, backgroundColor: '#1f1f1f' },
  posterStack: { width: 64, height: 96 },
  posterImage: { position: 'absolute', top: 0, left: 0 },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  posterFallbackText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  rowInfo: { marginLeft: 12, flex: 1, justifyContent: 'center' },
  movieTitle: { fontSize: 16, fontWeight: '600' },
  movieMeta: { marginTop: 6, fontSize: 12 },
  emptyText: { textAlign: 'center', marginTop: 24 },
});

export default ExploreScreen;
