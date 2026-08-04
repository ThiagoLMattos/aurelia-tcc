import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AppProvider } from '@/context/AppContext';
import { Colors } from '@/constants/theme';

// Force light theme — Aurélia is light-mode only for v1 (dark mode out of scope)
const AureliaTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.surface,
    primary: Colors.primary,
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <AppProvider>
      <ThemeProvider value={AureliaTheme}>
        <Stack>
          {/* Main tab navigator */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          {/* Routine builder — slides up from bottom */}
          <Stack.Screen
            name="routine-builder"
            options={{
              presentation: 'modal',
              headerShown: false,
              gestureEnabled: true,
            }}
          />

          {/* Geo-fence breach — full-screen, NOT gesture-dismissable */}
          <Stack.Screen
            name="geo-fence-breach"
            options={{
              presentation: 'fullScreenModal',
              headerShown: false,
              gestureEnabled: false, // deliberate safety pattern — see design spec
            }}
          />

          {/* Settings — pushed from Profile tab */}
          <Stack.Screen
            name="settings"
            options={{
              headerShown: false,
              presentation: 'card',
            }}
          />

          <Stack.Screen
            name="home-idoso"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="tarefa-idoso"
            options={{ headerShown: false }}
          />
        </Stack>
        <StatusBar style="light" backgroundColor={Colors.primary} />
      </ThemeProvider>
    </AppProvider>
  );
}
