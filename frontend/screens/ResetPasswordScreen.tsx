import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Button } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';

const ResetPasswordScreen = () => {
  const { requestPasswordReset, confirmPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onRequest = async () => {
    setError(null);
    setMessage(null);
    if (!email.trim()) {
      setError('Enter your email');
      return;
    }
    setLoading(true);
    try {
      const res = await requestPasswordReset(email.trim());
      setMessage(res.message);
      if (res.resetToken) {
        setToken(res.resetToken);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const onConfirm = async () => {
    setError(null);
    setMessage(null);
    if (!token.trim() || !newPassword) {
      setError('Enter token and new password');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await confirmPasswordReset(token.trim(), newPassword);
      setMessage(res.message);
      router.replace('/auth');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Button title={loading ? 'Sending…' : 'Send reset link'} onPress={onRequest} disabled={loading} />

      <View style={styles.divider} />

      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        placeholder="Reset token"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="New password"
        secureTextEntry
      />
      <Button title={loading ? 'Resetting…' : 'Reset password'} onPress={onConfirm} disabled={loading} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 8, marginBottom: 12 },
  divider: { height: 24 },
  error: { color: '#b00020', marginTop: 12, textAlign: 'center' },
  message: { color: '#0a7', marginTop: 12, textAlign: 'center' },
});

export default ResetPasswordScreen;
