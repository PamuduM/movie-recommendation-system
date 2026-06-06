import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, useColorScheme } from 'react-native';

const MovieDetailScreen = () => {
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load movie details
    setLoading(false);
  }, []);

  const textColor = colorScheme === 'dark' ? '#ffffff' : '#000000';
  const backgroundColor = colorScheme === 'dark' ? '#1a1a1a' : '#ffffff';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: textColor }]}>Movie Details</Text>
          <Text style={[styles.subtitle, { color: textColor }]}>
            Movie information, ratings, reviews, cast, trailers, and genres will be displayed here.
          </Text>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 16 },
});

export default MovieDetailScreen;
