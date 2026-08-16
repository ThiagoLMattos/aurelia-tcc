import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import 'react-native-reanimated';

import { PatientColors } from '@/constants/theme-elder';

const ElderTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: PatientColors.homeHeader,
  },
};

export const unstable_settings = {
  anchor: 'home-elder',
};

export default function RootLayout() {
  return (
    <ThemeProvider value={ElderTheme}>
      <Stack>
        <Stack.Screen
          name="home-elder"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="task-elder"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="games-elder"
          options={{ headerShown: false }}
        />
        {/* Improviso */}
        <Stack.Screen
          name="games-elder-embreve"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="sos-elder"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="phone-elder"
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="add-contact-elder" 
          options={{ headerShown: false }} 
        />
      </Stack>
    </ThemeProvider>
  );
}