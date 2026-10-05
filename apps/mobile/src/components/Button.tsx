import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { fontSizes, palette, Radius, Spacing, type Role } from '@/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  role?: Role;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, variant = 'primary', role = 'caregiver', loading = false, disabled = false, style }: ButtonProps) {
  const colors = palette[role];
  const inactive = disabled || loading;
  const filled = variant === 'primary' || variant === 'danger';
  const background = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : 'transparent';
  const foreground = filled ? colors.onPrimary : variant === 'secondary' ? colors.primary : colors.textMuted;
  const border = variant === 'secondary' ? colors.primary : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        role === 'elder' && styles.elder,
        { backgroundColor: background, borderColor: border, opacity: inactive ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Text style={[styles.label, { color: foreground, fontSize: fontSizes[role].body }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  elder: { minHeight: 76, borderRadius: Radius.xl },
  label: { fontWeight: '600', textAlign: 'center' },
});
