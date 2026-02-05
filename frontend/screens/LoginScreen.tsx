import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';

const LoginScreen = () => {
  const { loginWithEmailPassword, isLoading, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.id) {
      router.replace('/(tabs)');
    }
  }, [user?.id]);

  const onLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginWithEmailPassword(email.trim(), password);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {user ? <Text style={styles.success}>Logged in as {user.username}</Text> : null}

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title={submitting ? 'Logging in…' : 'Login'} onPress={onLogin} disabled={submitting} />

      <Pressable onPress={() => router.push('/reset-password')} style={styles.linkWrap}>
        <Text style={styles.linkText}>Forgot password?</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/register')} style={styles.linkWrap}>
        <Text style={styles.linkText}>Don’t have an account? Sign up</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 8, marginBottom: 12 },
  error: { color: '#b00020', marginBottom: 12, textAlign: 'center' },
  success: { color: '#0a7', marginBottom: 12, textAlign: 'center' },
  linkWrap: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#3366ff', fontWeight: '600' },
});

export default LoginScreen;
