/**
 * Aurélia — Design tokens
 * Single source of truth for colors, typography scale, and spacing.
 * All screens import from here — never hardcode hex values in component files.
 */

export const Colors = {
  // Primary — teal
  primary: '#0F8080',
  primaryDark: '#0A5F5F',
  primaryLight: '#E0F7FA',
  primaryText: '#0F6E56',

  // Surface & background
  surface: '#F8FAFC',
  white: '#FFFFFF',
  border: '#DDE3E8',
  borderLight: '#E2E6EA',
  borderMid: '#C8D0D8',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#5F5E5A',
  textMuted: '#9A9A95',

  // Sage green — completed / success
  successBg: '#EAF3DE',
  successText: '#3B6D11',
  successBorder: '#1D9E75',

  // Amber — missed / warning
  warningBg: '#FAEEDA',
  warningText: '#854F0B',
  warningBorder: '#EF9F27',
  warningAccent: '#FAC775',

  // Red — danger / breach / destructive
  dangerBg: '#FCEBEB',
  dangerText: '#A32D2D',
  dangerBorder: '#E24B4A',
  dangerHeader: '#A32D2D',
  dangerDot: '#E24B4A',

  // Lavender — Aurélia-branded elements ONLY
  aureliaBg: '#EEEDFE',
  aureliaText: '#534AB7',
  aureliaBorder: '#CECBF6',

  // Tab bar
  tabBarBg: '#FFFFFF',
  tabActive: '#0F8080',
  tabInactive: '#5F5E5A',

  // Misc
  progressBg: '#EEF1F3',
  inputBg: '#FFFFFF',
  skeletonBg: '#EEF1F3',
};

/**
 * Tab bar colors wired to expo-router tab layout.
 * Kept as light/dark shape so the tab layout can reference Colors[scheme].tint.
 */
export const TabColors = {
  light: {
    text: Colors.textPrimary,
    background: Colors.surface,
    tint: Colors.primary,
    icon: Colors.tabInactive,
    tabIconDefault: Colors.tabInactive,
    tabIconSelected: Colors.primary,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: Colors.primary,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: Colors.primary,
  },
};

export const Typography = {
  size: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.2,
    base: 1.45,
    relaxed: 1.6,
  },
};

export const Radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};
