import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, useColorScheme } from 'react-native';
import { fetchRecommendations } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type Recommendation = {
  id: number | string;
  title: string;
  poster_path?: string | null;
  release_date?: string | null;
  overview?: string | null;
};

const RecommendationsScreen = () => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const textColor = colorScheme === 'dark' ? '#ffffff' : '#000000';
  const backgroundColor = colorScheme === 'dark' ? '#1a1a1a' : '#ffffff';

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user?.id) {
        if (mounted) {
          setRecommendations([]);
          setError(null);
          setLoading(false);
        }
        return;
      }
      try {
        const data = await fetchRecommendations(user.id);
        if (mounted) {
          setRecommendations(Array.isArray(data) ? data : []);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) {
          const message = err?.response?.data?.error ?? err?.message ?? 'Failed to load recommendations';
          setError(message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const renderRecommendation = ({ item }: { item: Recommendation }) => (
    <View style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#f9f9f9' }]}>
      <Text style={[styles.title, { color: textColor }]}>{item.title}</Text>
      {item.release_date ? <Text style={styles.year}>{new Date(item.release_date).getFullYear()}</Text> : null}
      {item.overview ? (
        <Text style={[styles.overview, { color: textColor }]} numberOfLines={2}>
          {item.overview}
        </Text>
      ) : null}
    </View>
  );

  if (!user?.id) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor }]}>
        <Text style={[styles.message, { color: textColor }]}>Log in to get personalized recommendations.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor }]}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (recommendations.length === 0) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor }]}>
        <Text style={[styles.message, { color: textColor }]}>No recommendations available yet.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <FlatList
        data={recommendations}
        renderItem={renderRecommendation}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 32 },
  card: { borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  year: { fontSize: 12, color: '#888', marginBottom: 8 },
  overview: { fontSize: 13, lineHeight: 18 },
  message: { fontSize: 14, textAlign: 'center' },
  error: { color: '#d32f2f', fontSize: 14, textAlign: 'center' },
});

export default RecommendationsScreen;
