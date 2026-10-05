import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/theme';

import type { SafeZoneMapProps } from './SafeZoneMap.types';

export type { SafeZoneMapProps } from './SafeZoneMap.types';

/**
 * react-native-maps has no web version. The browser preview (mock mode) gets a plain box with the
 * coordinates instead; the real map is on the phone.
 */
export function SafeZoneMap({ zone, position, elderName, height = 220, style }: SafeZoneMapProps) {
  return (
    <View style={[styles.box, { height }, style]}>
      <Text style={styles.title}>Mapa disponível no celular</Text>
      <Text style={styles.line}>
        {zone ? `Zona segura: ${zone.lat.toFixed(5)}, ${zone.lng.toFixed(5)} · raio de ${zone.radiusM} m` : 'Sem zona segura'}
      </Text>
      {position ? <Text style={styles.line}>{`${elderName}: ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    borderRadius: Radius.lg,
    backgroundColor: Colors.progressBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.lg,
  },
  title: { fontSize: Typography.size.sm, fontWeight: '600', color: Colors.textPrimary },
  line: { fontSize: Typography.size.xs, color: Colors.textSecondary, textAlign: 'center' },
});
