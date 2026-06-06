import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

type ReviewItem = {
  id: number;
  userId: number;
  movieId: number;
  rating: number;
  comment?: string;
  createdAt?: string;
  user?: { id: number; username: string };
};

const ReviewsScreen = () => {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const textColor = colorScheme === 'dark' ? '#ffffff' : '#000000';
  const backgroundColor = colorScheme === 'dark' ? '#1a1a1a' : '#ffffff';

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [movieId, setMovieId] = useState('');
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');

  const fetchReviews = useCallback(async () => {
    if (!user?.id) {
      setReviews([]);
      setLoading(false);
      return;
    }
    try {
      const response = await api.get(`/reviews/user/${user.id}`);
      setReviews(Array.isArray(response.data) ? response.data : []);
      setError(null);
    } catch (err: any) {
      const message = err?.response?.data?.error ?? err?.message ?? 'Failed to load reviews';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReviews();
    setRefreshing(false);
  }, [fetchReviews]);

  const handleAddReview = useCallback(async () => {
    if (!movieId.trim() || !comment.trim() || !user?.id) {
      setError('Please fill in all fields');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await api.post('/reviews', {
        movieId: parseInt(movieId, 10),
        rating: parseInt(rating, 10),
        comment: comment.trim(),
      });
      setReviews((prev) => [response.data, ...prev]);
      setMovieId('');
      setRating('5');
      setComment('');
    } catch (err: any) {
      const message = err?.response?.data?.error ?? err?.message ?? 'Failed to add review';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [movieId, rating, comment, user?.id]);

  const renderReview = ({ item }: { item: ReviewItem }) => (
    <View style={[styles.reviewCard, { backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#f5f5f5' }]}>
      <View style={styles.reviewHeader}>
        <Text style={[styles.reviewUser, { color: textColor }]}>
          {item.user?.username || 'Anonymous'}
        </Text>
        <Text style={[styles.reviewRating, { color: '#ffc107' }]}>★ {item.rating}/5</Text>
      </View>
      <Text style={[styles.reviewComment, { color: textColor }]}>{item.comment}</Text>
    </View>
  );

  if (!user) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor }]}>
        <Text style={[styles.emptyText, { color: textColor }]}>Sign in to see reviews.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <FlatList
        data={reviews}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={renderReview}
        ListHeaderComponent={
          <View style={styles.formSection}>
            <Text style={[styles.formTitle, { color: textColor }]}>Add a Review</Text>
            <TextInput
              style={[styles.input, { borderColor: textColor, color: textColor }]}
              value={movieId}
              onChangeText={setMovieId}
              placeholder="Movie ID"
              placeholderTextColor="#999"
              keyboardType="number-pad"
            />
            <TextInput
              style={[styles.input, { borderColor: textColor, color: textColor }]}
              value={rating}
              onChangeText={setRating}
              placeholder="Rating (1-5)"
              placeholderTextColor="#999"
              keyboardType="number-pad"
            />
            <TextInput
              style={[styles.input, { borderColor: textColor, color: textColor, minHeight: 80 }]}
              value={comment}
              onChangeText={setComment}
              placeholder="Your review..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button
              title={submitting ? 'Submitting…' : 'Submit Review'}
              onPress={handleAddReview}
              disabled={submitting}
            />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: textColor }]}>No reviews yet.</Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  formSection: { marginVertical: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  formTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 14 },
  reviewCard: { borderRadius: 8, padding: 12, marginVertical: 8 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  reviewUser: { fontSize: 14, fontWeight: 'bold' },
  reviewRating: { fontSize: 14, fontWeight: 'bold' },
  reviewComment: { fontSize: 13, lineHeight: 20 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  errorText: { color: '#d32f2f', marginBottom: 12, textAlign: 'center' },
});

export default ReviewsScreen;
