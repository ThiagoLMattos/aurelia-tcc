import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Section } from '@/elder/ui';
import { playSound, type SoundName } from '@/sound';
import { PatientColors, PatientTypography, Shadow } from '@/theme';

export const GAMES_SECTION: Section = {
  main: PatientColors.gamesMain,
  headerButton: PatientColors.gamesHeaderButton,
  border: PatientColors.gamesHeaderBorder,
  text: PatientColors.gamesHeaderText,
};

const SOUND_OF: Record<'tap' | 'success' | 'miss' | 'win', SoundName> = { tap: 'tap', success: 'success', miss: 'miss', win: 'celebrate' };

/**
 * A sound, and a light buzz on phones that have it. `sound` replaces the kind's usual sound (the
 * sequence pads each play their own note).
 */
export function tapFeedback(kind: 'tap' | 'success' | 'miss' | 'win' = 'tap', sound: SoundName = SOUND_OF[kind]): void {
  playSound(sound);
  if (process.env.EXPO_OS === 'web') return;
  const done =
    kind === 'tap'
      ? Haptics.selectionAsync()
      : Haptics.notificationAsync(kind === 'miss' ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
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
