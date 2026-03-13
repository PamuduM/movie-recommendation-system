import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';

const AUTH_BACKGROUND = {
  uri: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1400&q=80',
};

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
    <ImageBackground
      source={AUTH_BACKGROUND}
      defaultSource={require('../assets/images/splash-icon.png')}
      style={styles.background}
      resizeMode="cover"
      blurRadius={8}
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>Lights. Camera. Stream your next obsession.</Text>

          <View style={styles.card}>
            {user ? <Text style={styles.success}>Logged in as {user.username}</Text> : null}

            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#aab0c5"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#aab0c5"
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
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  backgroundImage: { opacity: 0.92 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 10, 20, 0.38)',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  heading: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 6,
  },
  subheading: {
    color: '#c6cde5',
    fontSize: 14,
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(13, 18, 34, 0.84)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    color: '#f7f9ff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  error: { color: '#ff8f8f', marginBottom: 12, textAlign: 'center' },
  success: { color: '#6de3b0', marginBottom: 12, textAlign: 'center' },
  linkWrap: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#9ac3ff', fontWeight: '600' },
});

export default LoginScreen;
