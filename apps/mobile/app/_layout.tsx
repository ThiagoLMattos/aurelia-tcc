import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { SessionProvider, useSession } from '@/auth/SessionProvider';
import { queryClient, setupFocusManager } from '@/lib/query';
import { configureNotificationHandler } from '@/push/registerPush';
import { useNotificationRouting } from '@/push/useNotificationRouting';
import { usePushRegistration } from '@/push/usePushRegistration';
import { initSounds } from '@/sound';
import { Colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();
configureNotificationHandler();
void initSounds();

// Force light theme — Aurélia is light-mode only for v1 (dark mode out of scope)
const AureliaTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.surface,
    primary: Colors.primary,
  },
};

/** The navigator: each role only ever sees its own group, and signed-out users only `(auth)`. */
function RootNavigator() {
  const { status, role } = useSession();
  usePushRegistration();
  useNotificationRouting();

  // Keep the native splash up until we know whether someone is signed in, so there is no flash of the wrong screen.
  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn' && role === 'caregiver'}>
        <Stack.Screen name="(caregiver)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn' && role === 'elder'}>
        <Stack.Screen name="(elder)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => setupFocusManager(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={AureliaTheme}>
          <RootNavigator />
          <StatusBar style="dark" />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
