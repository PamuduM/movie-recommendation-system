import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Button, TextInput, FlatList, Image, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../contexts/AuthContext';
import {
  addToWatchlist as apiAddToWatchlist,
  fetchFollowers,
  fetchFollowing,
  fetchWatchlist,
  followUser,
  removeFromWatchlist as apiRemoveFromWatchlist,
  searchMovies,
  searchUsers,
  unfollowUser,
} from '../services/api';
import type { WatchlistEntry } from '../services/api';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type FollowUser = {
  id: number;
  username: string;
  avatar?: string | null;
  bio?: string | null;
};

type MovieSearchResult = {
  id: number | string;
  title?: string | null;
  name?: string | null;
  releaseDate?: string | null;
  release_date?: string | null;
  overview?: string | null;
  description?: string | null;
  poster?: string | null;
  poster_path?: string | null;
  genres?: Array<string | number>;
  genre_ids?: Array<string | number>;
};

import * as ImagePicker from 'expo-image-picker';

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
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [watchlistSearch, setWatchlistSearch] = useState('');
  const [watchlistResults, setWatchlistResults] = useState<MovieSearchResult[]>([]);
  const [watchlistSearchLoading, setWatchlistSearchLoading] = useState(false);
  const [watchlistAddingId, setWatchlistAddingId] = useState<number | null>(null);
  const [watchlistRemovingId, setWatchlistRemovingId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    setUsername(user.username ?? '');
    setEmail(user.email ?? '');
    setAvatar(user.avatar ?? '');
    setBio(user.bio ?? '');
  }, [user]);

  const pickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your photos to choose an avatar.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      const uri = (res as any).assets?.[0]?.uri ?? (res as any).uri;
      if (uri) {
        setAvatar(uri);
        setError(null);
        setMessage('Uploading avatar...');
        try {
          const updated = await updateProfile({ avatar: uri });
          setMessage('Avatar updated');
          setAvatar(updated.avatar ?? '');
        } catch (e: any) {
          setError(e?.response?.data?.error ?? e?.message ?? 'Failed to update avatar');
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Image picker error');
    }
  };

  const removeAvatar = async () => {
    if (!user) return;
    setMessage(null);
    setError(null);
    try {
      const updated = await updateProfile({ avatar: '' });
      setAvatar(updated.avatar ?? '');
      setMessage('Avatar removed');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Failed to remove avatar');
    }
  };

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

  const watchlistMovieIds = useMemo(() => new Set(watchlist.map((item) => item.movieId)), [watchlist]);

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

  const handleAvatarPress = () => {
    pickAvatar();
  };

  const handleFollowersPress = () => {
    const text = followers.length ? followers.map((item) => item.username).join('\n') : 'No followers yet.';
    Alert.alert('Followers', text);
  };

  const handleFollowingPress = () => {
    const text = following.length ? following.map((item) => item.username).join('\n') : 'Not following anyone yet.';
    Alert.alert('Following', text);
  };

  const loadWatchlist = useCallback(async () => {
    if (!user?.id) {
      setWatchlist([]);
      return;
    }
    setWatchlistLoading(true);
    setWatchlistError(null);
    try {
      const entries = await fetchWatchlist(user.id);
      setWatchlist(Array.isArray(entries) ? entries : []);
    } catch (e: any) {
      setWatchlistError(e?.response?.data?.error ?? e?.message ?? 'Failed to load watchlist');
    } finally {
      setWatchlistLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  useFocusEffect(
    useCallback(() => {
      loadWatchlist();
      return undefined;
    }, [loadWatchlist])
  );

  const handleWatchlistSearch = useCallback(async () => {
    const query = watchlistSearch.trim();
    if (query.length < 2) {
      setWatchlistResults([]);
      return;
    }
    setWatchlistSearchLoading(true);
    setWatchlistError(null);
    try {
      const results = await searchMovies(query);
      setWatchlistResults(Array.isArray(results) ? results.slice(0, 10) : []);
    } catch (e: any) {
      setWatchlistError(e?.response?.data?.error ?? e?.message ?? 'Movie search failed');
    } finally {
      setWatchlistSearchLoading(false);
    }
  }, [watchlistSearch]);

  const handleAddToWatchlist = useCallback(
    async (movieId: number, movie?: MovieSearchResult) => {
      if (!movieId || watchlistMovieIds.has(movieId)) return;
      setWatchlistError(null);
      setWatchlistAddingId(movieId);
      try {
        await apiAddToWatchlist(movieId, movie ? {
          title: movie.title ?? movie.name ?? null,
          name: movie.name ?? null,
          overview: movie.overview ?? movie.description ?? null,
          description: movie.description ?? null,
          poster: movie.poster ?? null,
          poster_path: movie.poster_path ?? null,
          releaseDate: movie.releaseDate ?? null,
          release_date: movie.release_date ?? null,
          genres: movie.genres,
          genre_ids: movie.genre_ids,
        } : undefined);
        await loadWatchlist();
        setMessage('Movie added to watchlist');
      } catch (e: any) {
        setWatchlistError(e?.response?.data?.error ?? e?.message ?? 'Failed to add movie');
      } finally {
        setWatchlistAddingId(null);
      }
    },
    [loadWatchlist, watchlistMovieIds]
  );

  const handleRemoveFromWatchlist = useCallback(
    async (entryId: number) => {
      if (!entryId) return;
      setWatchlistError(null);
      setWatchlistRemovingId(entryId);
      try {
        await apiRemoveFromWatchlist(entryId);
        await loadWatchlist();
        setMessage('Movie removed from watchlist');
      } catch (e: any) {
        setWatchlistError(e?.response?.data?.error ?? e?.message ?? 'Failed to remove movie');
      } finally {
        setWatchlistRemovingId(null);
      }
    },
    [loadWatchlist]
  );

  return (
    <View style={styles.container}>
      {user ? (
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View>
              <TouchableOpacity onPress={handleAvatarPress}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatarLarge} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitials}>{(user.username || 'U').slice(0, 2).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.cameraIconContainer}>
                  <MaterialIcons name="photo-camera" size={24} color="#fff" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={removeAvatar} style={styles.removeAvatarBtn}>
                <Text style={styles.removeAvatarText}>Remove avatar</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.username}>{user?.username}</Text>
              <Text style={styles.email}>{user?.email}</Text>
              <View style={styles.statsContainer}>
                <TouchableOpacity onPress={handleFollowersPress}>
                  <Text style={styles.statsNumber}>{followers.length}</Text>
                  <Text style={styles.statsLabel}>Followers</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleFollowingPress}>
                  <Text style={styles.statsNumber}>{following.length}</Text>
                  <Text style={styles.statsLabel}>Following</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.labelCol}>Username</Text>
            <TextInput
              style={[styles.input, styles.inputRow]}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.labelCol}>Email</Text>
            <TextInput
              style={[styles.input, styles.inputRow]}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.labelCol}>Avatar URL</Text>
            <TextInput
              style={[styles.input, styles.inputRow]}
              value={avatar}
              onChangeText={setAvatar}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.labelCol}>Bio</Text>
            <TextInput style={[styles.input, styles.inputRow]} value={bio} onChangeText={setBio} />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.labelCol}>Email status</Text>
            <Text style={[styles.value, styles.valueRow]}>{user?.emailVerified ? 'Verified' : 'Not verified'}</Text>
          </View>

          <Button title={saving ? 'Saving…' : 'Save changes'} onPress={onSave} disabled={saving} />

          {!user?.emailVerified ? (
            <View style={styles.actionSpacing}>
              <Button title="Verify email" onPress={() => router.push('/verify-email')} />
            </View>
          ) : null}

          <View style={styles.watchlistSection}>
            <Text style={styles.sectionTitle}>Watchlist ({watchlist.length})</Text>
            {watchlistError ? <Text style={styles.error}>{watchlistError}</Text> : null}
            {watchlistLoading ? (
              <Text style={styles.muted}>Loading watchlist…</Text>
            ) : watchlist.length ? (
              watchlist.map((entry) => {
                const releaseLabel = entry.Movie?.releaseDate ?? (entry.Movie as any)?.release_date ?? null;
                return (
                  <View key={`watchlist-${entry.id}`} style={styles.watchlistRow}>
                    <View style={styles.watchlistInfo}>
                      <Text style={styles.watchlistMovieTitle}>{entry.Movie?.title ?? `Movie #${entry.movieId}`}</Text>
                      {releaseLabel ? <Text style={styles.watchlistMovieMeta}>{releaseLabel}</Text> : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveFromWatchlist(entry.id)}
                      style={styles.watchlistRemoveBtn}
                      disabled={watchlistRemovingId === entry.id}
                    >
                      <Text style={styles.watchlistRemoveText}>
                        {watchlistRemovingId === entry.id ? 'Removing…' : 'Remove'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <Text style={styles.muted}>No movies saved yet.</Text>
            )}

            <Text style={styles.sectionSubtitle}>Add movies</Text>
            <TextInput
              style={styles.input}
              value={watchlistSearch}
              onChangeText={setWatchlistSearch}
              placeholder="Search FlickX movies"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={() => handleWatchlistSearch()}
            />
            <Button
              title={watchlistSearchLoading ? 'Searching…' : 'Search movies'}
              onPress={() => handleWatchlistSearch()}
              disabled={watchlistSearchLoading}
            />

            {watchlistResults.length ? (
              <View style={styles.watchlistResults}>
                {watchlistResults.map((result) => {
                  const movieId = Number(result.id);
                  const hasValidId = Number.isFinite(movieId) && movieId > 0;
                  const alreadyAdded = hasValidId ? watchlistMovieIds.has(movieId) : false;
                  const releaseLabel = result.releaseDate ?? result.release_date ?? null;
                  const disableButton = !hasValidId || alreadyAdded || watchlistAddingId === movieId;
                  return (
                    <View key={`watchlist-result-${result.id}`} style={styles.watchlistResultRow}>
                      <View style={styles.watchlistInfo}>
                        <Text style={styles.watchlistMovieTitle}>{result.title ?? 'Untitled movie'}</Text>
                        {releaseLabel ? <Text style={styles.watchlistMovieMeta}>{releaseLabel}</Text> : null}
                      </View>
                      <TouchableOpacity
                        onPress={() => (hasValidId ? handleAddToWatchlist(movieId, result) : undefined)}
                        disabled={disableButton}
                        style={[styles.watchlistAddBtn, disableButton && styles.watchlistAddBtnDisabled]}
                      >
                        <Text style={styles.watchlistAddText}>
                          {!hasValidId
                            ? 'Unavailable'
                            : alreadyAdded
                              ? 'Added'
                              : watchlistAddingId === movieId
                                ? 'Adding…'
                                : 'Add'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>

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
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <View style={styles.userRow}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.username}</Text>
                    {item.bio ? <Text style={styles.userBio}>{item.bio}</Text> : null}
                  </View>
                  <Button
                    title={item.isFollowing ? 'Unfollow' : 'Follow'}
                    onPress={() => toggleFollow(item)}
                    disabled={followBusyId === item.id}
                  />
                </View>
              )}
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
  profileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  profileInfo: { flex: 1, marginLeft: 16 },
  username: { fontSize: 18, fontWeight: '700' },
  email: { fontSize: 14, color: '#666', marginTop: 4 },
  statsContainer: { flexDirection: 'row', gap: 16, marginTop: 12 },
  statsNumber: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  statsLabel: { fontSize: 12, color: '#666', textAlign: 'center' },
  label: { fontSize: 12, color: '#666', marginTop: 8 },
  value: { fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 8, marginTop: 6 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  labelCol: { width: 110, fontSize: 12, color: '#666' },
  inputRow: { flex: 1, marginTop: 0 },
  valueRow: { flex: 1 },
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
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarContainer: { position: 'relative', width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eee' },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 24, fontWeight: '700', color: '#666' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', borderRadius: 16, padding: 2, elevation: 2 },
  cameraIconContainer: { position: 'absolute', bottom: 4, right: 4, backgroundColor: '#00000088', padding: 6, borderRadius: 16 },
  removeAvatarBtn: { marginTop: 8 },
  removeAvatarText: { color: '#b00020', fontSize: 12 },
  watchlistSection: { marginTop: 24 },
  sectionSubtitle: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  watchlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  watchlistInfo: { flex: 1, marginRight: 12 },
  watchlistMovieTitle: { fontSize: 15, fontWeight: '600' },
  watchlistMovieMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  watchlistRemoveBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#fdecea' },
  watchlistRemoveText: { color: '#b00020', fontWeight: '600' },
  watchlistResults: { marginTop: 12 },
  watchlistResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  watchlistAddBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#0a7',
  },
  watchlistAddBtnDisabled: { backgroundColor: '#ccc' },
  watchlistAddText: { color: '#fff', fontWeight: '600' },
});

export default ProfileScreen;
