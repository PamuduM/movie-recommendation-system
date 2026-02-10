import React, { useState } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet } from 'react-native';
import { searchMovies, searchUsers } from '../services/api';

type UserResult = {
  id: number;
  username: string;
  avatar?: string | null;
  bio?: string | null;
};

const SearchScreen = () => {
  const [movieQuery, setMovieQuery] = useState('');
  const [movieResults, setMovieResults] = useState<any[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserResult[]>([]);

  const handleMovieSearch = async () => {
    if (movieQuery.trim()) {
      const data = await searchMovies(movieQuery.trim());
      setMovieResults(data);
    } else {
      setMovieResults([]);
    }
  };

  const handleUserSearch = async () => {
    if (userQuery.trim().length >= 2) {
      const data = await searchUsers(userQuery.trim());
      setUserResults(data);
    } else {
      setUserResults([]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Find users</Text>
      <TextInput
        style={styles.input}
        value={userQuery}
        onChangeText={setUserQuery}
        placeholder="Search by username"
      />
      <Button title="Search users" onPress={handleUserSearch} />
      <FlatList
        data={userResults}
        renderItem={({ item }) => (
          <View style={styles.userRow}>
            <Text style={styles.userName}>{item.username}</Text>
            {item.bio ? <Text style={styles.userBio}>{item.bio}</Text> : null}
          </View>
        )}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={
          userQuery.trim().length >= 2 ? <Text style={styles.emptyText}>No users found.</Text> : null
        }
      />

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
  userRow: { paddingVertical: 8 },
  userName: { fontSize: 15, fontWeight: '600' },
  userBio: { marginTop: 4, color: '#666' },
  emptyText: { marginTop: 8, color: '#666' },
});

export default SearchScreen;
