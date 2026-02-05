import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, TextInput } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';

const ProfileScreen = () => {
  const { user, logout, updateProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [bio, setBio] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setUsername(user.username ?? '');
    setEmail(user.email ?? '');
    setAvatar(user.avatar ?? '');
    setBio(user.bio ?? '');
  }, [user]);

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
        </View>
      ) : (
        <Text style={styles.muted}>Log in to see your profile.</Text>
      )}

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
});

export default ProfileScreen;
