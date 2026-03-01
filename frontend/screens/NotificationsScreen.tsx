import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type NotificationItem = {
  id: number;
  type: string;
  message: string;
  read: boolean;
  createdAt?: string;
};

const TYPE_META: Record<string, { icon: string; label: string; accent: string }> = {
  follow: { icon: 'person-add', label: 'New Follower', accent: '#1877f2' },
  review: { icon: 'chatbubble-ellipses', label: 'Review', accent: '#fbbc04' },
  recommendation: { icon: 'sparkles', label: 'Recommendation', accent: '#34c759' },
  default: { icon: 'notifications', label: 'Notification', accent: '#8e8e93' },
};

const getTypeMeta = (type?: string) => TYPE_META[type ?? ''] ?? TYPE_META.default;

const formatRelativeTime = (timestamp?: string) => {
  if (!timestamp) return '';
  const value = new Date(timestamp).getTime();
  if (Number.isNaN(value)) return '';
  const diff = Date.now() - value;
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
};

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const fetchNotifications = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!user?.id) return;
      setError(null);
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      try {
        const response = await api.get(`/notifications/${user.id}`);
        setNotifications(response.data ?? []);
      } catch (err: any) {
        const message = err?.response?.data?.error ?? err?.message ?? 'Failed to load notifications';
        setError(message);
      } finally {
        if (mode === 'initial') setLoading(false);
        if (mode === 'refresh') setRefreshing(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    fetchNotifications('initial');
  }, [fetchNotifications]);

  const handleRefresh = useCallback(() => fetchNotifications('refresh'), [fetchNotifications]);

  const renderNotification = ({ item }: { item: NotificationItem }) => {
    const meta = getTypeMeta(item.type);
    return (
      <View style={[styles.card, !item.read ? styles.cardUnread : null]}>
        <View style={[styles.iconBadge, { backgroundColor: meta.accent }]}>
          <Ionicons name={meta.icon as any} size={20} color="#fff" />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.message}>{item.message}</Text>
          <View style={styles.metaRow}>
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>{meta.label}</Text>
            </View>
            <Text style={styles.timeText}>{formatRelativeTime(item.createdAt)}</Text>
          </View>
        </View>
        {!item.read ? <View style={styles.unreadDot} /> : null}
      </View>
    );
  };

  if (!user?.id) {
    return (
      <View style={styles.centered}> 
        <Text style={styles.muted}>Log in to see notifications tailored for you.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && notifications.length === 0 ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color="#1877f2" />
          <Text style={styles.loadingText}>Fetching updates…</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={
            notifications.length === 0 ? styles.listEmptyContainer : styles.listContainer
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.muted}>You are all caught up!</Text>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f8',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111',
  },
  error: { color: '#b00020', marginBottom: 12 },
  loadingState: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  loadingText: { marginTop: 8, color: '#444' },
  listContainer: { paddingBottom: 32 },
  listEmptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: { height: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#1877f2',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardBody: { flex: 1 },
  message: { fontSize: 15, color: '#111', fontWeight: '600' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  typePill: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  typePillText: { fontSize: 12, color: '#4c51bf', fontWeight: '600' },
  timeText: { fontSize: 12, color: '#666' },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1877f2',
    marginLeft: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  muted: { color: '#777', textAlign: 'center' },
});

export default NotificationsScreen;
