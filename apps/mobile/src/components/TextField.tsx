import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { fontSizes, palette, Radius, Spacing, type Role } from '@/theme';

interface TextFieldProps extends Omit<TextInputProps, 'style' | 'role'> {
  label: string;
  error?: string;
  role?: Role;
}

/** Labelled input with the validation message underneath. */
export function TextField({ label, error, role = 'caregiver', ...input }: TextFieldProps) {
  const colors = palette[role];
  const size = fontSizes[role];

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.text, fontSize: size.small }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        {...input}
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.card, borderColor: error ? colors.danger : colors.border, fontSize: size.body },
        ]}
      />
      {error ? <Text style={[styles.error, { color: colors.danger, fontSize: size.small }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.xs },
  label: { fontWeight: '600' },
  input: { minHeight: 52, borderWidth: 1.5, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg },
  error: {},
});
