import { StyleSheet, Text, View } from 'react-native';

import { fontSizes, palette, Radius, Spacing, type Role } from '@/theme';

/** The message for a failed submit (wrong password, no connection, …), shown above the button. */
export function FormError({ message, role = 'caregiver' }: { message: string | null; role?: Role }) {
  if (!message) return null;
  const colors = palette[role];
  return (
    <View accessibilityRole="alert" style={[styles.box, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
      <Text style={{ color: colors.danger, fontSize: fontSizes[role].small }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md },
});
