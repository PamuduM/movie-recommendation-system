import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    setError(null);
    api
      .get(`/notifications/${user.id}`)
      .then((res) => {
        if (isMounted) setNotifications(res.data);
      })
      .catch((err) => {
        if (!isMounted) return;
        const message = err?.response?.data?.error ?? err?.message ?? 'Failed to load notifications';
        setError(message);
      });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      {!user?.id ? <Text>Log in to see your notifications.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={notifications}
        renderItem={({ item }) => <Text>{item.message}</Text>}
        keyExtractor={(item) => item.id.toString()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  error: { color: '#b00020', marginBottom: 12 },
});

export default NotificationsScreen;
