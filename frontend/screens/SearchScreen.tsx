import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { fetchTmdbGenres, searchMovies, searchMoviesByPeopleKeywords } from '../services/api';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const CURRENT_YEAR = new Date().getFullYear();
const EARLIEST_YEAR = 1950;
const FALLBACK_GENRES = [
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'History',
  'Horror',
  'Mystery',
  'Romance',
  'Science Fiction',
  'Thriller',
];

const SORT_OPTIONS = [
  { label: 'Newest first', value: 'release-desc' },
  { label: 'Oldest first', value: 'release-asc' },
  { label: 'Title (A–Z)', value: 'title-asc' },
  { label: 'Title (Z–A)', value: 'title-desc' },
];

const SearchScreen = () => {
  const [movieQuery, setMovieQuery] = useState('');
  const [movieResults, setMovieResults] = useState<any[]>([]);
  const [yearRange, setYearRange] = useState<[number, number]>([2000, CURRENT_YEAR]);
  const [genreOptions, setGenreOptions] = useState<string[]>(FALLBACK_GENRES);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [sortValue, setSortValue] = useState<'release-desc' | 'release-asc' | 'title-asc' | 'title-desc'>(
    'release-desc'
  );
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiKeywordQuery, setAiKeywordQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'standard' | 'ai'>('standard');
  const { width } = useWindowDimensions();
  const sliderLength = Math.max(width - 48, 240);

  const hasQuery = movieQuery.trim().length > 0;
  const hasAiQuery = aiKeywordQuery.trim().length > 0;

  useEffect(() => {
    let active = true;
    const loadGenres = async () => {
      try {
        const data = await fetchTmdbGenres();
        const names = Array.isArray(data?.genres)
          ? data.genres.map((g: { name: string }) => g.name).filter(Boolean)
          : [];
        if (active && names.length) {
          setGenreOptions(names);
          setSelectedGenres((prev) => prev.filter((name) => names.includes(name)));
        }
      } catch (err) {
        if (active) {
          setGenreOptions(FALLBACK_GENRES);
          setSelectedGenres((prev) => prev.filter((name) => FALLBACK_GENRES.includes(name)));
        }
      }
    };
    loadGenres();
    return () => {
      active = false;
    };
  }, []);

  const handleMovieSearch = async () => {
    const trimmedQuery = movieQuery.trim();
    if (!trimmedQuery) {
      setMovieResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);
    setAiError(null);
    try {
      const data = await searchMovies(trimmedQuery, {
        yearRange,
        genres: selectedGenres,
        sort: sortValue,
      });
      setMovieResults(data);
      setSearchMode('standard');
    } catch (err) {
      setError('Unable to complete the search. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAiKeywordSearch = async () => {
    const trimmedQuery = aiKeywordQuery.trim();
    if (!trimmedQuery) {
      setMovieResults([]);
      return;
    }

    setIsAiSearching(true);
    setAiError(null);
    setError(null);
    try {
      const data = await searchMoviesByPeopleKeywords(trimmedQuery);
      setMovieResults(Array.isArray(data?.results) ? data.results : []);
      setSearchMode('ai');
    } catch (err) {
      setAiError('Unable to complete AI people search. Please try again.');
    } finally {
      setIsAiSearching(false);
    }
  };

  const handleYearRangeChange = (values: number[]) => {
    if (values.length < 2) return;
    const [start, end] = values;
    setYearRange([
      Math.round(Math.min(start, end)),
      Math.round(Math.max(start, end)),
    ]);
  };

  const toggleGenre = (name: string) => {
    setSelectedGenres((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  const selectedGenreHint =
    selectedGenres.length === 0
      ? 'All genres'
      : `${selectedGenres.length} selected`;

  const activeSortLabel = SORT_OPTIONS.find((option) => option.value === sortValue)?.label;

  const handleSortSelect = (value: (typeof SORT_OPTIONS)[number]['value']) => {
    setSortValue(value);
    setSortMenuOpen(false);
  };

  const renderMovieItem = ({ item }: { item: any }) => {
    const releaseDateValue = item.releaseDate ?? item.release_date;
    const releaseYear = releaseDateValue ? new Date(releaseDateValue).getFullYear() : '—';
    const movieTitle = item.title ?? item.original_title ?? 'Untitled';
    return (
      <View style={styles.resultRow}>
        <Text style={styles.resultTitle}>{movieTitle}</Text>
        <Text style={styles.resultMeta}>{releaseYear}</Text>
      </View>
    );
  };

  const listEmptyComponent = searchMode === 'ai' ? (
    <Text style={styles.emptyText}>No movies matched the AI people search query.</Text>
  ) : hasQuery ? (
    <Text style={styles.emptyText}>No movies match the current filters.</Text>
  ) : (
    <Text style={styles.emptyText}>Enter a movie title to start searching.</Text>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Find movies</Text>
      <TextInput
        style={styles.input}
        value={movieQuery}
        onChangeText={setMovieQuery}
        placeholder="Enter movie title or genre"
        autoCorrect={false}
        autoCapitalize="none"
      />

      <View style={styles.sliderSection}>
        <View style={styles.rangeHeader}>
          <Text style={styles.sectionSubtitle}>Release year range</Text>
          <Text style={styles.rangeValue}>
            {yearRange[0]} – {yearRange[1]}
          </Text>
        </View>
        <MultiSlider
          min={EARLIEST_YEAR}
          max={CURRENT_YEAR}
          step={1}
          values={yearRange}
          allowOverlap={false}
          snapped
          sliderLength={sliderLength}
          onValuesChange={handleYearRangeChange}
          containerStyle={styles.sliderContainer}
          trackStyle={styles.sliderTrack}
          selectedStyle={styles.sliderSelected}
          unselectedStyle={styles.sliderUnselected}
          markerStyle={styles.sliderMarker}
          pressedMarkerStyle={styles.sliderMarkerPressed}
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.yearLabel}>{EARLIEST_YEAR}</Text>
          <Text style={styles.yearLabel}>{CURRENT_YEAR}</Text>
        </View>
      </View>

      <View style={styles.genreSection}>
        <View style={styles.genreHeader}>
          <Text style={styles.sectionSubtitle}>Genres</Text>
          <Text style={styles.genreHint}>{selectedGenreHint}</Text>
        </View>
        <View style={styles.checkboxGrid}>
          {genreOptions.map((name) => {
            const checked = selectedGenres.includes(name);
            return (
              <Pressable
                key={name}
                style={[styles.checkboxChip, checked && styles.checkboxChipChecked]}
                onPress={() => toggleGenre(name)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
              >
                <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
                  {checked ? <View style={styles.checkboxIndicator} /> : null}
                </View>
                <Text
                  style={[styles.checkboxLabel, checked && styles.checkboxLabelChecked]}
                  numberOfLines={1}
                >
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.sortSection}>
        <Text style={styles.sectionSubtitle}>Sort by</Text>
        <Pressable
          onPress={() => setSortMenuOpen((prev) => !prev)}
          style={styles.sortSelector}
          accessibilityRole="button"
          accessibilityState={{ expanded: sortMenuOpen }}
        >
          <Text style={styles.sortValueText}>{activeSortLabel}</Text>
          <MaterialIcons
            name={sortMenuOpen ? 'expand-less' : 'expand-more'}
            size={20}
            color="#4b5563"
          />
        </Pressable>
        {sortMenuOpen ? (
          <View style={styles.sortDropdown}>
            {SORT_OPTIONS.map((option) => {
              const selected = option.value === sortValue;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.sortOption, selected && styles.sortOptionSelected]}
                  onPress={() => handleSortSelect(option.value)}
                  accessibilityRole="menuitemradio"
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={[styles.sortOptionLabel, selected && styles.sortOptionLabelSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <Button
        title={isSearching ? 'Searching…' : 'Search movies'}
        onPress={handleMovieSearch}
        disabled={!hasQuery || isSearching}
      />

      <View style={styles.aiSection}>
        <Text style={styles.sectionSubtitle}>AI people keyword search</Text>
        <TextInput
          style={styles.input}
          value={aiKeywordQuery}
          onChangeText={setAiKeywordQuery}
          placeholder="Try: director Nolan, cast DiCaprio"
          autoCorrect={false}
          autoCapitalize="none"
        />
        <Button
          title={isAiSearching ? 'Searching AI…' : 'Search by director/cast/actor/actress'}
          onPress={handleAiKeywordSearch}
          disabled={!hasAiQuery || isAiSearching}
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {aiError ? <Text style={styles.errorText}>{aiError}</Text> : null}

      <FlatList
        data={movieResults}
        renderItem={renderMovieItem}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={listEmptyComponent}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 12, marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  genreSection: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  genreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  genreHint: { fontSize: 12, color: '#6b7280' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    marginVertical: 12,
    fontSize: 16,
  },
  sliderSection: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
  },
  rangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rangeValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  sliderContainer: {
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  sliderTrack: {
    height: 6,
  },
  sliderSelected: {
    backgroundColor: '#6366F1',
  },
  sliderUnselected: {
    backgroundColor: '#e5e7eb',
  },
  sliderMarker: {
    height: 24,
    width: 24,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    borderWidth: 2,
    borderColor: '#fff',
  },
  sliderMarkerPressed: {
    height: 28,
    width: 28,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  yearLabel: { fontSize: 12, color: '#6b7280' },
  sortSection: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  sortSelector: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sortValueText: { fontSize: 15, color: '#111827' },
  sortDropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
  },
  sortOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  sortOptionSelected: {
    backgroundColor: '#eef2ff',
  },
  sortOptionLabel: { fontSize: 14, color: '#111827' },
  sortOptionLabelSelected: { fontWeight: '600', color: '#4338ca' },
  aiSection: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checkboxChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  checkboxChipChecked: {
    borderColor: '#6366F1',
    backgroundColor: '#eef2ff',
  },
  checkboxBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#9ca3af',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxBoxChecked: {
    borderColor: '#4f46e5',
    backgroundColor: '#4f46e5',
  },
  checkboxIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  checkboxLabel: { fontSize: 13, color: '#111827', maxWidth: 120 },
  checkboxLabelChecked: { fontWeight: '600', color: '#312e81' },
  errorText: {
    color: '#dc2626',
    marginTop: 8,
    marginBottom: 4,
  },
  listContent: {
    paddingVertical: 16,
  },
  resultRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultTitle: { fontSize: 16, fontWeight: '500', color: '#111827', flexShrink: 1 },
  resultMeta: { fontSize: 14, color: '#6b7280', marginLeft: 12 },
  emptyText: { marginTop: 16, color: '#6b7280', textAlign: 'center' },
});

export default SearchScreen;
