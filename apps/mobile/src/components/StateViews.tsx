import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { fontSizes, palette, Spacing, type Role } from '@/theme';

import { Button } from './Button';

interface StateProps {
  role?: Role;
}

export function LoadingState({ role = 'caregiver', message = 'Carregando…' }: StateProps & { message?: string }) {
  const colors = palette[role];
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.text, { color: colors.textMuted, fontSize: fontSizes[role].body }]}>{message}</Text>
    </View>
  );
}

export function EmptyState({
  role = 'caregiver',
  title,
  message,
  actionLabel,
  onAction,
}: StateProps & { title: string; message?: string; actionLabel?: string; onAction?: () => void }) {
  const colors = palette[role];
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: colors.text, fontSize: fontSizes[role].title }]}>{title}</Text>
      {message ? <Text style={[styles.text, { color: colors.textMuted, fontSize: fontSizes[role].body }]}>{message}</Text> : null}
      {actionLabel && onAction ? <Button role={role} title={actionLabel} onPress={onAction} style={styles.action} /> : null}
    </View>
  );
}

export function ErrorState({
  role = 'caregiver',
  message = 'Não foi possível carregar. Tente novamente.',
  onRetry,
}: StateProps & { message?: string; onRetry?: () => void }) {
  const colors = palette[role];
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: colors.danger, fontSize: fontSizes[role].title }]}>Algo deu errado</Text>
      <Text style={[styles.text, { color: colors.textMuted, fontSize: fontSizes[role].body }]}>{message}</Text>
      {onRetry ? <Button role={role} title="Tentar de novo" variant="secondary" onPress={onRetry} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xxl },
  title: { fontWeight: '700', textAlign: 'center' },
  text: { textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: Spacing.sm },
});
