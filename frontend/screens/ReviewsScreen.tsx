import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ReviewsScreen = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Reviews</Text>
    {/* List and add user reviews */}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
});

export default ReviewsScreen;
