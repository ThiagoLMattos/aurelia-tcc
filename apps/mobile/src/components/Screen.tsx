import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, Spacing, type Role } from '@/theme';

interface ScreenProps {
  role?: Role;
  /** Wraps the content in a ScrollView that keeps focused inputs above the keyboard. */
  scroll?: boolean;
  /** Vertically centres the content (welcome, empty states). */
  centered?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** Safe-area page with the role's background; the base of every new screen. */
export function Screen({ role = 'caregiver', scroll = false, centered = false, contentStyle, children }: ScreenProps) {
  const colors = palette[role];
  const content = [styles.content, centered && styles.centered, contentStyle];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={[content, styles.scroll]} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={content}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { flex: 1, padding: Spacing.xxl, gap: Spacing.lg },
  centered: { justifyContent: 'center' },
});
