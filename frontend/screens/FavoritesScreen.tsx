import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useColorScheme } from '../hooks/use-color-scheme';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

type FavoriteItem = {
  id: number;
  movieId: number;
  Movie?: { id: number; title: string };
  createdAt?: string;
};

const FavoritesScreen = () => {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const textColor = colorScheme === 'dark' ? '#ffffff' : '#000000';
  const backgroundColor = colorScheme === 'dark' ? '#1a1a1a' : '#ffffff';
  const borderColor = colorScheme === 'dark' ? '#333333' : '#e0e0e0';

  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const fetchFavorites = useCallback(async () => {
    if (!user?.id) {
      setFavorites([]);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      const response = await api.get(`/favorites/${user.id}`);
      setFavorites(Array.isArray(response.data) ? response.data : []);
      setError(null);
    } catch (err: any) {
      const message = err?.response?.data?.error ?? err?.message ?? 'Failed to load favorites';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFavorites();
    setRefreshing(false);
  }, [fetchFavorites]);

  const handleRemove = useCallback(async (favoriteId: number) => {
    setRemovingId(favoriteId);
    try {
      await api.delete(`/favorites/${favoriteId}`);
      setFavorites((prev) => prev.filter((fav) => fav.id !== favoriteId));
    } catch (err: any) {
      const message = err?.response?.data?.error ?? err?.message ?? 'Failed to remove favorite';
      setError(message);
    } finally {
      setRemovingId(null);
    }
  }, []);

  const renderItem = ({ item }: { item: FavoriteItem }) => (
    <View style={[styles.row, { borderColor }]}>
      <Text style={[styles.rowTitle, { color: textColor }]} numberOfLines={1}>
        {item.Movie?.title ?? `Movie #${item.movieId}`}
      </Text>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => handleRemove(item.id)}
        disabled={removingId === item.id}
      >
        <Text style={styles.removeBtnText}>
          {removingId === item.id ? 'Removing…' : 'Remove'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (!user) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor }]}>
        <Text style={[styles.emptyText, { color: textColor }]}>Sign in to see your favorites.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <FlatList
        data={favorites}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: textColor }]}>No favorite movies yet.</Text>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 4,
    borderBottomWidth: 1,
  },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: '500' },
  removeBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  removeBtnText: { color: '#d32f2f', fontSize: 12, fontWeight: '600' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  errorText: { color: '#d32f2f', paddingHorizontal: 16, paddingVertical: 8, textAlign: 'center' },
});

export default FavoritesScreen;
