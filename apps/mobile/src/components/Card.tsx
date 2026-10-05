import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { palette, Radius, Spacing, type Role } from '@/theme';

interface CardProps {
  role?: Role;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export function Card({ role = 'caregiver', style, children }: CardProps) {
  const colors = palette[role];
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg, gap: Spacing.sm },
});
