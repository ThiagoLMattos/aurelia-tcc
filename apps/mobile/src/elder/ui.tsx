import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Layout, PatientTypography, Shadow } from '@/theme';

/** One colour family of the elder app (SOS red, tasks green, phone blue, …), as the screens' headers use it. */
export interface Section {
  main: string;
  headerButton: string;
  border: string;
  text: string;
}

export const MIN_TOUCH = 56;

/** Header drawn by every elder screen: the section title and a big VOLTAR button. */
export function ElderHeader({ title, section, onBack, backLabel = 'VOLTAR', titleSize = PatientTypography.size.header }: {
  title: string;
  section: Section;
  onBack: () => void;
  backLabel?: string;
  titleSize?: number;
}) {
  return (
    <View style={[styles.header, { backgroundColor: section.main }]}>
      <StatusBar style="light" backgroundColor={section.main} />
      <Text style={[styles.title, { color: section.text, fontSize: titleSize }]} numberOfLines={2} adjustsFontSizeToFit accessibilityRole="header">
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        onPress={onBack}
        style={[styles.back, { backgroundColor: section.headerButton, borderColor: section.border }]}
      >
        <Text style={[styles.backText, { color: section.text }]}>{backLabel}</Text>
      </Pressable>
    </View>
  );
}

/** A big full-width button; `tone` picks which colour of the section it takes. */
export function BigButton({ label, onPress, color, textColor, disabled, loading, style, accessibilityLabel }: {
  label: string;
  onPress: () => void;
  color: string;
  textColor: string;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.big, { backgroundColor: color, opacity: inactive ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      <Text style={[styles.bigText, { color: textColor }]}>{loading ? '…' : label}</Text>
    </Pressable>
  );
}

/** Bottom sheet in the section's colours: a question, optional detail, then big buttons. */
export function Sheet({ visible, onClose, accent, background = '#F1EFE8', children }: {
  visible: boolean;
  onClose: () => void;
  accent: string;
  background?: string;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: background, borderTopColor: accent }]}>{children}</View>
      </View>
    </Modal>
  );
}

export function SheetText({ children, strong, color = '#2C2C2C' }: { children: ReactNode; strong?: boolean; color?: string }) {
  return (
    <Text style={[strong ? styles.sheetStrong : styles.sheetQuestion, { color }]} accessibilityRole={strong ? 'header' : undefined}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    height: Layout.headerHeight,
    zIndex: 1,
    gap: 12,
    ...Shadow.header,
  },
  title: { flex: 1, fontWeight: PatientTypography.weight.regular },
  back: { borderWidth: 1.5, borderRadius: 10, minHeight: MIN_TOUCH, paddingVertical: 14, paddingHorizontal: 20, justifyContent: 'center', flexShrink: 0 },
  backText: { fontSize: PatientTypography.size.backButton },
  big: { minHeight: 72, borderRadius: 12, paddingVertical: 18, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  bigText: { fontSize: PatientTypography.size.sheet, fontWeight: PatientTypography.weight.bold, textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  sheet: { borderTopWidth: 7, padding: 24, gap: 16, ...Shadow.sheet },
  sheetQuestion: { fontSize: PatientTypography.size.reduced, textAlign: 'center' },
  sheetStrong: { fontSize: PatientTypography.size.sheet, fontWeight: PatientTypography.weight.bold, textAlign: 'center' },
});
