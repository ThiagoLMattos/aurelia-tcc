import { SafeZoneSchema } from '@aurelia/shared';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, FormError, Screen, ScreenHeader } from '@/components';
import { confirm } from '@/lib/confirm';
import { friendlyError } from '@/lib/errors';
import { firstName } from '@/lib/format';
import { useCurrentElder, usePatchElder } from '@/queries';
import { Colors, Radius, Spacing, Typography } from '@/theme';

const RADIUS_STEPS = [50, 100, 150, 200, 300, 400, 500] as const;
const MIN_STEP = 50;
const MAX_STEP = 500;
const PREVIEW = 200;

/** Where the elder is "safe": a centre (the phone's current position) and a radius. */
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
      setError('Defina o centro da zona usando a sua localização atual.');
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

  const circle = PREVIEW * (0.3 + 0.55 * ((radiusM - MIN_STEP) / (MAX_STEP - MIN_STEP)));

  return (
    <Screen scroll>
      <ScreenHeader title="Zona segura" />
      <Text style={styles.lead}>
        Vá até o local onde {firstName(elder.name)} fica (a casa, por exemplo) e use sua localização atual como centro. Você
        será avisado quando ela sair do raio escolhido.
      </Text>

      <Card style={styles.previewCard}>
        <View style={[styles.preview, { width: PREVIEW, height: PREVIEW }]}>
          <View style={[styles.circle, { width: circle, height: circle, borderRadius: circle / 2 }]} />
          <View style={styles.pin} />
        </View>
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
  preview: { backgroundColor: Colors.progressBg, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  circle: { position: 'absolute', borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  pin: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.primary },
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
