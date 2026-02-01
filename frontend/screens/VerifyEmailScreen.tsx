import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Button } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';

const VerifyEmailScreen = () => {
  const { requestEmailVerification, confirmEmailVerification, user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [token, setToken] = useState('');
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
      const res = await requestEmailVerification(email.trim());
      setMessage(res.message);
      if (res.verificationToken) setToken(res.verificationToken);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const onConfirm = async () => {
    setError(null);
    setMessage(null);
    if (!token.trim()) {
      setError('Enter verification token');
      return;
    }
    setLoading(true);
    try {
      await confirmEmailVerification(token.trim());
      setMessage('Email verified');
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Email</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Button title={loading ? 'Sending…' : 'Send verification'} onPress={onRequest} disabled={loading} />

      <View style={styles.divider} />

      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        placeholder="Verification token"
        autoCapitalize="none"
      />
      <Button title={loading ? 'Verifying…' : 'Verify email'} onPress={onConfirm} disabled={loading} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 8, marginBottom: 12 },
  divider: { height: 24 },
  error: { color: '#b00020', marginTop: 12, textAlign: 'center' },
  message: { color: '#0a7', marginTop: 12, textAlign: 'center' },
});

export default VerifyEmailScreen;
