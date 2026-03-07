import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { Text, TextInput } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeProvider as AppThemeProvider } from '@/contexts/ThemeContext';
import { useEffect } from 'react';

export const unstable_settings = {
  anchor: '(tabs)',
};

const originalTextDefaults = (Text as any).defaultProps ?? {};
const originalTextInputDefaults = (TextInput as any).defaultProps ?? {};

function AuthGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const rootSegment = segments[0];
    const inAuthFlow =
      rootSegment === 'auth' ||
      rootSegment === 'register' ||
      rootSegment === 'reset-password' ||
      rootSegment === 'verify-email';

    if (!user && !inAuthFlow) {
      router.replace('/auth');
      return;
    }

    if (user && inAuthFlow) {
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments, router]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="verify-email" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootNavigation />
    </AppThemeProvider>
  );
}

function RootNavigation() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const textColor = colorScheme === 'dark' ? '#ffffff' : '#000000';

    (Text as any).defaultProps = {
      ...originalTextDefaults,
      style: [{ color: textColor }, originalTextDefaults.style].filter(Boolean),
    };

    (TextInput as any).defaultProps = {
      ...originalTextInputDefaults,
      style: [{ color: textColor }, originalTextInputDefaults.style].filter(Boolean),
    };
  }, [colorScheme]);

  return (
    <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AuthGate />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </AuthProvider>
    </NavigationThemeProvider>
  );
}
