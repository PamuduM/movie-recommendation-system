import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const WatchlistScreen = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Watchlist</Text>
    {/* List of movies user wants to watch */}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
});

export default WatchlistScreen;
