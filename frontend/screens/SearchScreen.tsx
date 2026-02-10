import React, { useState } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet } from 'react-native';
import { searchMovies } from '../services/api';

const SearchScreen = () => {
  const [movieQuery, setMovieQuery] = useState('');
  const [movieResults, setMovieResults] = useState<any[]>([]);

  const handleMovieSearch = async () => {
    if (movieQuery.trim()) {
      const data = await searchMovies(movieQuery.trim());
      setMovieResults(data);
    } else {
      setMovieResults([]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Find movies</Text>
      <TextInput
        style={styles.input}
        value={movieQuery}
        onChangeText={setMovieQuery}
        placeholder="Enter movie title or genre"
      />
      <Button title="Search movies" onPress={handleMovieSearch} />
      <FlatList
        data={movieResults}
        renderItem={({ item }) => <Text>{item.title}</Text>}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={
          movieQuery.trim() ? <Text style={styles.emptyText}>No movies found.</Text> : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 8, marginVertical: 8 },
  emptyText: { marginTop: 8, color: '#666' },
});

export default SearchScreen;
