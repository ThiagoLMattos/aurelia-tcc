import { Stack } from 'expo-router';

/** The elder side: big, simple screens, no tabs. Each screen draws its own header in the elder theme. */
export default function ElderLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
