/**
 * Aurélia is light-mode only for v1.
 * This hook is kept for compatibility with boilerplate components (ThemedText, ThemedView).
 * New Aurélia screens import directly from @/constants/theme instead of using this hook.
 */

import { Colors } from '@/constants/theme';

// Minimal colour map that satisfies the ThemedText/ThemedView contracts
const COMPAT_COLORS = {
  text: Colors.textPrimary,
  background: Colors.surface,
  tint: Colors.primary,
  icon: Colors.tabInactive,
  tabIconDefault: Colors.tabInactive,
  tabIconSelected: Colors.primary,
};

type CompatColorName = keyof typeof COMPAT_COLORS;

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: CompatColorName
): string {
  if (props.light) return props.light;
  return COMPAT_COLORS[colorName];
}
