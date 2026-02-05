import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { fetchRecommendations } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const RecommendationsScreen = () => {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    fetchRecommendations(user.id).then(setRecommendations);
  }, [user?.id]);

  return (
    <View style={styles.container}>
      {!user?.id ? <Text>Log in to get personalized recommendations.</Text> : null}
      <FlatList
        data={recommendations}
        renderItem={({ item }) => <Text>{item.title}</Text>}
        keyExtractor={(item) => item.id.toString()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
});

export default RecommendationsScreen;
