import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ErrorState, FormError, LoadingState, Screen, ScreenHeader, TextField } from '@/components';
import { confirm } from '@/lib/confirm';
import { friendlyError } from '@/lib/errors';
import { formatElapsed } from '@/lib/format';
import { useCreateDevice, useCurrentElder, useDeleteDevice, useElderDetail, useNow } from '@/queries';
import { Colors, Spacing, Typography } from '@/theme';

/** Credentials shown once, right after registering a tracker. */
function SecretCard({ deviceId, secret, onDone }: { deviceId: string; secret: string; onDone: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (label: string, value: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(label);
  };
  return (
    <Card style={styles.secretCard}>
      <Text style={styles.warning}>Guarde estes dados agora. O segredo aparece uma única vez e não dá para recuperá-lo depois.</Text>
      <Text style={styles.fieldLabel}>ID do rastreador</Text>
      <Text selectable style={styles.mono}>{deviceId}</Text>
      <Button title={copied === 'id' ? 'ID copiado' : 'Copiar ID'} variant="secondary" onPress={() => void copy('id', deviceId)} />
      <Text style={styles.fieldLabel}>Segredo</Text>
      <Text selectable style={styles.mono}>{secret}</Text>
      <Button title={copied === 'secret' ? 'Segredo copiado' : 'Copiar segredo'} variant="secondary" onPress={() => void copy('secret', secret)} />
      <Button title="Já guardei" onPress={onDone} />
    </Card>
  );
}

/** Registers the ESP32 tracker and lists the ones already registered. */
export default function TrackerScreen() {
  const elder = useCurrentElder();
  const detail = useElderDetail(elder.id);
  const create = useCreateDevice(elder.id);
  const remove = useDeleteDevice(elder.id);
  const now = useNow();
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ deviceId: string; secret: string } | null>(null);

  const register = () => {
    if (!label.trim()) {
      setError('Dê um nome ao rastreador (ex: Chaveiro).');
      return;
    }
    setError(null);
    create.mutate(label.trim(), {
      onSuccess: (result) => {
        setCreated(result);
        setLabel('');
      },
      onError: (e) => setError(friendlyError(e)),
    });
  };

  const confirmRemove = async (id: string, name: string) => {
    const ok = await confirm('Remover rastreador', `“${name}” deixará de enviar a localização.`, 'Remover', true);
    if (!ok) return;
    remove.mutate(id, { onError: (e) => Alert.alert('Não foi possível remover', friendlyError(e)) });
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Rastreador" />

      {created ? <SecretCard {...created} onDone={() => setCreated(null)} /> : null}

      <Card>
        <Text style={styles.cardTitle}>Cadastrar rastreador</Text>
        <TextField label="Nome" placeholder="ex: Chaveiro" value={label} onChangeText={setLabel} />
        <FormError message={error} />
        <Button title="Cadastrar" loading={create.isPending} onPress={register} />
      </Card>

      <Text style={styles.cardTitle}>Cadastrados</Text>
      {detail.isPending ? <LoadingState /> : null}
      {detail.isError ? <ErrorState message={friendlyError(detail.error)} onRetry={() => void detail.refetch()} /> : null}
      {detail.data && detail.data.devices.length === 0 ? <Text style={styles.muted}>Nenhum rastreador cadastrado.</Text> : null}
      {detail.data?.devices.map((device) => (
        <Card key={device.id}>
          <View style={styles.deviceHead}>
            <Text style={styles.deviceName}>{device.label}</Text>
            <Text style={styles.muted}>{device.batteryPct === null ? '' : `${Math.round(device.batteryPct)}% bateria`}</Text>
          </View>
          <Text style={styles.muted}>
            {device.lastSeenAt ? `Último sinal há ${formatElapsed(now.getTime() - Date.parse(device.lastSeenAt))}` : 'Ainda sem sinal'}
          </Text>
          <Button title="Remover" variant="ghost" onPress={() => void confirmRemove(device.id, device.label)} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  secretCard: { borderColor: Colors.warningBorder, backgroundColor: Colors.warningBg },
  warning: { color: Colors.warningText, fontWeight: '600', fontSize: Typography.size.base },
  fieldLabel: { fontSize: Typography.size.sm, color: Colors.textSecondary, marginTop: Spacing.sm },
  mono: { fontFamily: 'Courier', fontSize: Typography.size.base, color: Colors.textPrimary },
  cardTitle: { fontSize: Typography.size.md, fontWeight: '700', color: Colors.textPrimary },
  muted: { fontSize: Typography.size.sm, color: Colors.textSecondary },
  deviceHead: { flexDirection: 'row', justifyContent: 'space-between' },
  deviceName: { fontSize: Typography.size.base, fontWeight: '600', color: Colors.textPrimary },
});
