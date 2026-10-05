import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { regionFor } from '@/lib/mapRegion';
import { Colors, Radius, Spacing, Typography } from '@/theme';

import type { SafeZoneMapProps } from './SafeZoneMap.types';

export type { SafeZoneMapProps } from './SafeZoneMap.types';

const PIN_COLOR = { inside: Colors.successBorder, outside: Colors.dangerDot, unknown: Colors.textSecondary } as const;
const STATUS_LABEL = { inside: 'dentro da zona segura', outside: 'fora da zona segura', unknown: 'situação desconhecida' } as const;

/**
 * A real map with the safe-zone circle and the elder's last position. Apple Maps on iOS, Google Maps on
 * Android (an Android build needs `GOOGLE_MAPS_API_KEY`; Expo Go has its own). When the zone or the
 * position changes (a new report every 30 s, a new centre or radius), the map moves to show both again.
 */
export function SafeZoneMap({ zone, position, status, elderName, height = 220, onPressCoordinate, style }: SafeZoneMapProps) {
  const ref = useRef<MapView>(null);
  const region = useMemo(() => regionFor(zone, position), [zone, position]);
  const firstRegion = useRef(region);

  useEffect(() => {
    if (region) ref.current?.animateToRegion(region, 400);
  }, [region]);

  if (!region) {
    return (
      <View style={[styles.empty, { height }, style]}>
        <Text style={styles.emptyText}>Defina a zona segura ou aguarde o primeiro sinal do rastreador para ver o mapa.</Text>
      </View>
    );
  }

  const label = [
    zone ? `Zona segura de ${zone.radiusM} metros.` : 'Sem zona segura.',
    position ? `${elderName}: ${STATUS_LABEL[status]}.` : 'Sem posição do rastreador.',
  ].join(' ');

  return (
    <View style={[styles.frame, { height }, style]} accessible accessibilityLabel={`Mapa. ${label}`}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={firstRegion.current ?? region}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onPress={onPressCoordinate ? (e) => onPressCoordinate({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude }) : undefined}
      >
        {zone ? (
          <>
            <Circle
              center={{ latitude: zone.lat, longitude: zone.lng }}
              radius={zone.radiusM}
              strokeColor={Colors.primary}
              strokeWidth={2}
              fillColor="rgba(15,128,128,0.15)"
            />
            <Marker
              coordinate={{ latitude: zone.lat, longitude: zone.lng }}
              title="Centro da zona segura"
              pinColor={Colors.primary}
            />
          </>
        ) : null}
        {position ? (
          <Marker
            coordinate={{ latitude: position.lat, longitude: position.lng }}
            title={elderName}
            description={STATUS_LABEL[status]}
            pinColor={PIN_COLOR[status]}
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.progressBg },
  empty: {
    width: '100%',
    borderRadius: Radius.lg,
    backgroundColor: Colors.progressBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  emptyText: { fontSize: Typography.size.sm, color: Colors.textSecondary, textAlign: 'center' },
});
