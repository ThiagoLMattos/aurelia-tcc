import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Section } from '@/elder/ui';
import { PatientColors, PatientTypography, Shadow } from '@/theme';

export const GAMES_SECTION: Section = {
  main: PatientColors.gamesMain,
  headerButton: PatientColors.gamesHeaderButton,
  border: PatientColors.gamesHeaderBorder,
  text: PatientColors.gamesHeaderText,
};

/** A light tap on phones that have it; nothing on the web preview. */
export function tapFeedback(kind: 'tap' | 'success' | 'miss' = 'tap'): void {
  if (process.env.EXPO_OS === 'web') return;
  const done =
    kind === 'tap'
      ? Haptics.selectionAsync()
      : Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
  void done.catch(() => undefined);
}

/** The card shown when a game ends: always a word of encouragement, then the buttons. */
export function GameOverCard({ title, message, children }: { title: string; message: string; children: ReactNode }) {
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.buttons}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PatientColors.gamesCardBg,
    borderColor: PatientColors.gamesMain,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 24,
    gap: 16,
    ...Shadow.soft,
  },
  title: { fontSize: PatientTypography.size.header, fontWeight: PatientTypography.weight.bold, color: PatientColors.gamesMain, textAlign: 'center' },
  message: { fontSize: PatientTypography.size.common, color: '#2C2C2A', textAlign: 'center' },
  buttons: { gap: 12 },
});
