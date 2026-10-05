import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { mapsUrl } from '@/lib/format';
import { Colors, Radius, Spacing, Typography } from '@/theme';

import type { SafeZoneMapProps } from './SafeZoneMap.types';

/**
 * Where no map can be drawn (the browser preview, an Android build without a Google Maps key): the
 * zone and the position as text, and a button that opens the phone's own maps app on the point.
 */
export function MapFallback({ zone, position, elderName, height = 220, style }: SafeZoneMapProps) {
  const target = position ?? zone;
  return (
    <View style={[styles.box, { minHeight: Math.min(height, 160) }, style]}>
      <Text style={styles.title}>Mapa indisponível neste aparelho</Text>
      <Text style={styles.line}>
        {zone ? `Zona segura: ${zone.lat.toFixed(5)}, ${zone.lng.toFixed(5)} · raio de ${zone.radiusM} m` : 'Sem zona segura'}
      </Text>
      {position ? <Text style={styles.line}>{`${elderName}: ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`}</Text> : null}
      {target ? (
        <Pressable
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
          onPress={() => void Linking.openURL(mapsUrl(target.lat, target.lng))}
          accessibilityRole="link"
        >
          <Text style={styles.buttonText}>{position ? `Ver ${elderName} no Google Maps` : 'Ver a zona no Google Maps'}</Text>
        </Pressable>
      ) : null}
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
  button: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  buttonText: { fontSize: Typography.size.sm, fontWeight: '600', color: Colors.primary },
});
