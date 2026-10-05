import { haversineMeters } from '@aurelia/shared';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, Screen, ScreenHeader } from '@/components';
import { SafeZoneMap } from '@/components/SafeZoneMap';
import { friendlyError } from '@/lib/errors';
import { clockTime, firstName, formatElapsed, mapsUrl } from '@/lib/format';
import { useCurrentElder, useLocation, useNow } from '@/queries';
import { Colors, Spacing, Typography } from '@/theme';

/**
 * Where the elder is now: the tracker's last position on a map with the safe-zone circle. The location
 * query refreshes every 30 s while the screen is open, and the map follows each new report.
 */
export default function LocationScreen() {
  const elder = useCurrentElder();
  const router = useRouter();
  const location = useLocation(elder.id);
  const now = useNow(10_000);
  const name = firstName(elder.name);

  const lat = location.data?.lat ?? null;
  const lng = location.data?.lng ?? null;
  const position = useMemo(() => (lat !== null && lng !== null ? { lat, lng } : null), [lat, lng]);

  if (location.isPending) {
    return (
      <Screen>
        <ScreenHeader title="Localização" />
        <LoadingState />
      </Screen>
    );
  }
  if (location.isError) {
    return (
      <Screen>
        <ScreenHeader title="Localização" />
        <ErrorState message={friendlyError(location.error)} onRetry={() => void location.refetch()} />
      </Screen>
    );
  }

  const data = location.data;
  const zone = data.safeZone;
  const distance = position && zone ? Math.round(haversineMeters(position, zone)) : null;
  const statusText =
    data.status === 'inside'
      ? `${name} está dentro da zona segura`
      : data.status === 'outside'
        ? `${name} está fora da zona segura`
        : 'Situação desconhecida';
  const statusColor =
    data.status === 'inside' ? Colors.successText : data.status === 'outside' ? Colors.dangerText : Colors.textSecondary;

  return (
    <Screen scroll>
      <ScreenHeader title="Localização" />

      <SafeZoneMap zone={zone} position={position} status={data.status} elderName={name} height={320} />

      <Card>
        <Text style={[styles.status, { color: statusColor }]}>{statusText}</Text>
        <Row
          label="Posição recebida"
          value={data.at ? `${clockTime(data.at, elder.timezone)} (há ${formatElapsed(now.getTime() - Date.parse(data.at))})` : 'Ainda nenhuma'}
        />
        <Row
          label="Distância do centro"
          value={distance === null ? '—' : zone && distance > zone.radiusM ? `~${distance} m (${distance - zone.radiusM} m além do raio)` : `~${distance} m`}
        />
        <Row
          label="Rastreador"
          value={data.deviceLastSeenAt ? `Último sinal há ${formatElapsed(now.getTime() - Date.parse(data.deviceLastSeenAt))}` : 'Sem sinal registrado'}
        />
        <Text style={styles.hint}>O mapa se atualiza sozinho a cada 30 segundos enquanto esta tela está aberta.</Text>
      </Card>

      {position ? (
        <Button title="Abrir no app de mapas" variant="secondary" onPress={() => void Linking.openURL(mapsUrl(position.lat, position.lng))} />
      ) : null}
      {data.status === 'outside' ? (
        <Button title="Ver alerta de saída" onPress={() => router.push('/(caregiver)/geo-fence-breach')} />
      ) : null}
      <Button
        title={zone ? 'Ajustar zona segura' : 'Definir zona segura'}
        variant="ghost"
        onPress={() => router.push('/(caregiver)/safe-zone')}
      />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { fontSize: Typography.size.base, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  label: { fontSize: Typography.size.sm, color: Colors.textSecondary },
  value: { fontSize: Typography.size.sm, color: Colors.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  hint: { fontSize: Typography.size.xs, color: Colors.textSecondary, marginTop: Spacing.xs },
});
