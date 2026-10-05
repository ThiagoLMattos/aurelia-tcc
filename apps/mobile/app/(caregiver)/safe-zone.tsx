import { SafeZoneSchema } from '@aurelia/shared';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, FormError, Screen, ScreenHeader } from '@/components';
import { SafeZoneMap } from '@/components/SafeZoneMap';
import { confirm } from '@/lib/confirm';
import { friendlyError } from '@/lib/errors';
import { firstName } from '@/lib/format';
import { nativeMapAvailable } from '@/lib/nativeMap';
import { useCurrentElder, usePatchElder } from '@/queries';
import { Colors, Radius, Spacing, Typography } from '@/theme';

const RADIUS_STEPS = [50, 100, 150, 200, 300, 400, 500] as const;
/**
 * Where the elder is "safe": a centre and a radius, drawn on a map. The centre starts from the phone's
 * current position; tapping the map moves it (to set the zone without being there).
 */
export default function SafeZoneScreen() {
  const elder = useCurrentElder();
  const router = useRouter();
  const patch = usePatchElder(elder.id);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(
    elder.safeZone ? { lat: elder.safeZone.lat, lng: elder.safeZone.lng } : null,
  );
  const [radiusM, setRadiusM] = useState<number>(elder.safeZone?.radiusM ?? 150);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const locateMe = async () => {
    setError(null);
    setDenied(false);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDenied(true);
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCenter({ lat: coords.latitude, lng: coords.longitude });
    } catch {
      setError('Não foi possível obter a localização. Verifique se o GPS está ligado e tente de novo.');
    } finally {
      setLocating(false);
    }
  };

  const save = () => {
    const parsed = SafeZoneSchema.safeParse({ ...center, radiusM });
    if (!parsed.success) {
      setError(nativeMapAvailable ? 'Defina o centro da zona: use sua localização atual ou toque no mapa.' : 'Defina o centro da zona: use sua localização atual.');
      return;
    }
    setError(null);
    patch.mutate({ safeZone: parsed.data }, { onSuccess: () => router.back(), onError: (e) => setError(friendlyError(e)) });
  };

  const remove = async () => {
    const ok = await confirm('Remover zona segura', 'Sem a zona segura, saídas não serão detectadas.', 'Remover', true);
    if (!ok) return;
    patch.mutate({ safeZone: null }, { onSuccess: () => router.back(), onError: (e) => setError(friendlyError(e)) });
  };

  const zone = useMemo(() => (center ? { ...center, radiusM } : null), [center, radiusM]);

  return (
    <Screen scroll>
      <ScreenHeader title="Zona segura" />
      <Text style={styles.lead}>
        Use sua localização atual como centro (estando na casa de {firstName(elder.name)}, por exemplo)
        {nativeMapAvailable ? ' e depois toque no mapa para ajustar o ponto, se precisar' : ''}. Você será avisado
        quando ela sair do raio escolhido.
      </Text>

      <Card style={styles.previewCard}>
        <SafeZoneMap
          zone={zone}
          position={null}
          status="unknown"
          elderName={firstName(elder.name)}
          height={260}
          onPressCoordinate={setCenter}
        />
        <Text style={styles.coords}>
          {center ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)} · raio de ${radiusM} m` : 'Centro ainda não definido'}
        </Text>
      </Card>

      <Button title="Usar minha localização atual" variant="secondary" loading={locating} onPress={() => void locateMe()} />
      {denied ? (
        <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()}>
          <Text style={styles.link}>Permissão negada. Toque para abrir os ajustes e permitir a localização.</Text>
        </Pressable>
      ) : null}

      <Text style={styles.label}>Raio da zona segura</Text>
      <View style={styles.steps}>
        {RADIUS_STEPS.map((step) => (
          <Pressable
            key={step}
            accessibilityRole="radio"
            accessibilityState={{ selected: radiusM === step }}
            onPress={() => setRadiusM(step)}
            style={[styles.step, radiusM === step && styles.stepActive]}
          >
            <Text style={[styles.stepText, radiusM === step && styles.stepTextActive]}>{step} m</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>Raios menores detectam saídas mais cedo; maiores evitam alarmes falsos.</Text>

      <FormError message={error} />
      <Button title="Salvar zona segura" loading={patch.isPending} onPress={save} />
      {elder.safeZone ? <Button title="Remover zona segura" variant="ghost" onPress={() => void remove()} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: Typography.size.base, color: Colors.textSecondary, lineHeight: 22 },
  previewCard: { alignItems: 'center', gap: Spacing.md },
  coords: { fontSize: Typography.size.sm, color: Colors.textSecondary },
  label: { fontSize: Typography.size.sm, fontWeight: '600', color: Colors.textPrimary },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  step: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.white },
  stepActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  stepText: { color: Colors.textSecondary },
  stepTextActive: { color: Colors.primaryText, fontWeight: '600' },
  hint: { fontSize: Typography.size.sm, color: Colors.textSecondary },
  link: { color: Colors.primary, fontSize: Typography.size.sm },
});
