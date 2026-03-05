import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWatchlist, removeFromWatchlist, type WatchlistEntry } from '@/services/api';
import { useFocusEffect } from '@react-navigation/native';

const WatchlistScreen = () => {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const surfaceBorder = colorScheme === 'dark' ? '#2a2a2a' : '#e2e8f0';
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!user?.id) {
      setEntries([]);
      setError(null);
      return;
    }
    try {
      const data = await fetchWatchlist(user.id);
      setEntries(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: any) {
      const message = err?.response?.data?.error ?? err?.message ?? 'Failed to load watchlist';
      setError(message);
    }
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!mounted) return;
      setLoading(true);
      await fetchEntries();
      if (mounted) setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, [fetchEntries]);

  useFocusEffect(
    useCallback(() => {
      fetchEntries();
      return undefined;
    }, [fetchEntries])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEntries();
    setRefreshing(false);
  }, [fetchEntries]);

  const handleRemove = useCallback(
    async (entryId: number) => {
      if (!entryId) return;
      setRemovingId(entryId);
      try {
        await removeFromWatchlist(entryId);
        setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
      } catch (err: any) {
        const message = err?.response?.data?.error ?? err?.message ?? 'Unable to update watchlist';
        Alert.alert('Watchlist', message);
      } finally {
        setRemovingId(null);
      }
    },
    []
  );

  const renderItem = ({ item }: { item: WatchlistEntry }) => (
    <View style={[styles.row, { borderColor: surfaceBorder }]}>
      <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
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
      <View style={[styles.container, styles.center]}>
        <Text style={[styles.emptyText, { color: colors.text }]}>Sign in to see your watchlist.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {error ? <Text style={[styles.errorText, { color: '#d7263d' }]}>{error}</Text> : null}
      <FlatList
        data={entries}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.tint} />
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: colors.icon }]}>No movies saved yet.</Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.tint}
            colors={[colors.tint]}
          />
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
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  removeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fdecea',
    marginLeft: 12,
  },
  removeBtnText: { color: '#b00020', fontWeight: '600' },
  emptyText: { textAlign: 'center', fontSize: 14 },
  errorText: { textAlign: 'center', marginVertical: 12 },
});

export default WatchlistScreen;
