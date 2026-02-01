import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/notifications/${user.id}`).then((res) => setNotifications(res.data));
  }, [user?.id]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      {!user?.id ? <Text>Log in to see your notifications.</Text> : null}
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
});

export default NotificationsScreen;
