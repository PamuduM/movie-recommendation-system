import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Button, TextInput, FlatList } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';
import { fetchFollowers, fetchFollowing, followUser, searchUsers, unfollowUser } from '../services/api';

type FollowUser = {
  id: number;
  username: string;
  avatar?: string | null;
  bio?: string | null;
};

const ProfileScreen = () => {
  const { user, logout, updateProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [bio, setBio] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [followError, setFollowError] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<FollowUser[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());
  const [followBusyId, setFollowBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    setUsername(user.username ?? '');
    setEmail(user.email ?? '');
    setAvatar(user.avatar ?? '');
    setBio(user.bio ?? '');
  }, [user]);

  useEffect(() => {
    let mounted = true;
    if (!user?.id) return;
    setFollowError(null);
    Promise.all([fetchFollowers(user.id), fetchFollowing(user.id)])
      .then(([followersList, followingList]) => {
        if (!mounted) return;
        setFollowers(followersList);
        setFollowing(followingList);
        setFollowingIds(new Set(followingList.map((item: FollowUser) => item.id)));
      })
      .catch((e: any) => {
        if (!mounted) return;
        setFollowError(e?.response?.data?.error ?? e?.message ?? 'Failed to load follows');
      });
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const onSave = async () => {
    if (!user) return;
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const updated = await updateProfile({
        username: username.trim() || undefined,
        email: email.trim() || undefined,
        avatar: avatar.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      setMessage('Profile updated');
      setUsername(updated.username ?? '');
      setEmail(updated.email ?? '');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleUserSearch = async () => {
    if (userQuery.trim().length >= 2) {
      const data = await searchUsers(userQuery.trim());
      setUserResults(data);
    } else {
      setUserResults([]);
    }
  };

  const userResultsWithFollowState = useMemo(() => {
    return userResults.map((item) => ({
      ...item,
      isFollowing: followingIds.has(item.id),
    }));
  }, [userResults, followingIds]);

  const toggleFollow = async (target: FollowUser & { isFollowing: boolean }) => {
    if (!user?.id) return;
    setFollowBusyId(target.id);
    try {
      if (target.isFollowing) {
        await unfollowUser(target.id);
        setFollowingIds((prev) => {
          const next = new Set(prev);
          next.delete(target.id);
          return next;
        });
        setFollowing((prev) => prev.filter((item) => item.id !== target.id));
      } else {
        await followUser(target.id);
        setFollowingIds((prev) => new Set(prev).add(target.id));
        setFollowing((prev) => (prev.some((item) => item.id === target.id) ? prev : [...prev, target]));
      }
    } finally {
      setFollowBusyId(null);
    }
  };

  return (
    <View style={styles.container}>
      {user ? (
        <View style={styles.card}>
          <Text style={styles.label}>Username</Text>
          <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Avatar URL</Text>
          <TextInput style={styles.input} value={avatar} onChangeText={setAvatar} autoCapitalize="none" />

          <Text style={styles.label}>Bio</Text>
          <TextInput style={styles.input} value={bio} onChangeText={setBio} />

          <Text style={styles.label}>Email status</Text>
          <Text style={styles.value}>{user.emailVerified ? 'Verified' : 'Not verified'}</Text>

          <Button title={saving ? 'Saving…' : 'Save changes'} onPress={onSave} disabled={saving} />

          {!user.emailVerified ? (
            <View style={styles.actionSpacing}>
              <Button title="Verify email" onPress={() => router.push('/verify-email')} />
            </View>
          ) : null}

          <View style={styles.searchSection}>
            <Text style={styles.sectionTitle}>Find users</Text>
            <TextInput
              style={styles.input}
              value={userQuery}
              onChangeText={setUserQuery}
              placeholder="Search by username"
            />
            <Button title="Search users" onPress={handleUserSearch} />
            <FlatList
              data={userResultsWithFollowState}
              renderItem={({ item }) => (
                <View style={styles.userRow}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.username}</Text>
                    {item.bio ? <Text style={styles.userBio}>{item.bio}</Text> : null}
                  </View>
                  <Button
                    title={item.isFollowing ? 'Following' : 'Follow'}
                    onPress={() => toggleFollow(item)}
                    disabled={followBusyId === item.id}
                  />
                </View>
              )}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={
                userQuery.trim().length >= 2 ? <Text style={styles.emptyText}>No users found.</Text> : null
              }
            />
          </View>

          <View style={styles.followSection}>
            <Text style={styles.sectionTitle}>Followers ({followers.length})</Text>
            {followers.length ? (
              followers.map((item) => (
                <Text key={`follower-${item.id}`} style={styles.followItem}>
                  {item.username}
                </Text>
              ))
            ) : (
              <Text style={styles.muted}>No followers yet.</Text>
            )}

            <Text style={styles.sectionTitle}>Following ({following.length})</Text>
            {following.length ? (
              following.map((item) => (
                <Text key={`following-${item.id}`} style={styles.followItem}>
                  {item.username}
                </Text>
              ))
            ) : (
              <Text style={styles.muted}>Not following anyone yet.</Text>
            )}
          </View>
        </View>
      ) : (
        <Text style={styles.muted}>Log in to see your profile.</Text>
      )}

      {followError ? <Text style={styles.error}>{followError}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      {user ? <Button title="Logout" onPress={logout} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  card: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  label: { fontSize: 12, color: '#666', marginTop: 8 },
  value: { fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 8, marginTop: 6 },
  muted: { textAlign: 'center', color: '#666', marginBottom: 16 },
  error: { color: '#b00020', textAlign: 'center', marginBottom: 12 },
  message: { color: '#0a7', textAlign: 'center', marginBottom: 12 },
  actionSpacing: { marginTop: 12 },
  searchSection: { marginTop: 16 },
  followSection: { marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginTop: 12 },
  followItem: { marginTop: 6 },
  userRow: { paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600' },
  userBio: { marginTop: 4, color: '#666' },
  emptyText: { marginTop: 8, color: '#666' },
});

export default ProfileScreen;
