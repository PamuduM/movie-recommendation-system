import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MovieDetailScreen = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Movie Details</Text>
    {/* Movie info, ratings, reviews, cast, trailers, genres */}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
});

export default MovieDetailScreen;
