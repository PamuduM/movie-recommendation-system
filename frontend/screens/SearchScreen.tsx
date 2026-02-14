import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { searchMovies } from '../services/api';

const CURRENT_YEAR = new Date().getFullYear();
const EARLIEST_YEAR = 1950;

const SearchScreen = () => {
  const [movieQuery, setMovieQuery] = useState('');
  const [movieResults, setMovieResults] = useState<any[]>([]);
  const [yearRange, setYearRange] = useState<[number, number]>([2000, CURRENT_YEAR]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const sliderLength = Math.max(width - 48, 240);

  const hasQuery = movieQuery.trim().length > 0;

  const handleMovieSearch = async () => {
    const trimmedQuery = movieQuery.trim();
    if (!trimmedQuery) {
      setMovieResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const data = await searchMovies(trimmedQuery, { yearRange });
      setMovieResults(data);
    } catch (err) {
      setError('Unable to complete the search. Please try again.');
    } finally {
      setIsSearching(false);
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

  const renderMovieItem = ({ item }: { item: any }) => {
    const releaseYear = item.releaseDate ? new Date(item.releaseDate).getFullYear() : '—';
    return (
      <View style={styles.resultRow}>
        <Text style={styles.resultTitle}>{item.title}</Text>
        <Text style={styles.resultMeta}>{releaseYear}</Text>
      </View>
    );
  };

  const listEmptyComponent = hasQuery ? (
    <Text style={styles.emptyText}>No movies found in this year range.</Text>
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

      <Button
        title={isSearching ? 'Searching…' : 'Search movies'}
        onPress={handleMovieSearch}
        disabled={!hasQuery || isSearching}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={movieResults}
        renderItem={renderMovieItem}
        keyExtractor={(item) => item.id.toString()}
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
