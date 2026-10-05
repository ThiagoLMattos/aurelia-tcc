import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, Screen } from '@/components';
import { friendlyError } from '@/lib/errors';
import { clockTime, firstName, formatPhone, mapsUrl } from '@/lib/format';
import { useContacts, useCurrentElder, useEvents } from '@/queries';
import { Colors, Spacing, Typography } from '@/theme';

/**
 * Opened by the SOS push: who asked for help, when, where (if the phone could tell) and the numbers
 * to call, emergency contacts first. Full-screen and not swipe-dismissable; "Estou a caminho" closes
 * it (in v1 that only dismisses, nobody is told).
 */
export default function SosAlertScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ elderId?: string; eventId?: string }>();
  const elder = useCurrentElder();
  const events = useEvents(elder.id, { types: ['sos'] });
  const contacts = useContacts(elder.id);

  const sos = useMemo(() => {
    const items = events.data?.pages[0]?.items ?? [];
    const match = items.find((e) => e.id === eventId) ?? items[0];
    return match?.type === 'sos' ? match : undefined;
  }, [events.data, eventId]);

  const ordered = useMemo(() => {
    const items = contacts.data?.items ?? [];
    return [...items.filter((c) => c.isEmergency), ...items.filter((c) => !c.isEmergency)];
  }, [contacts.data]);

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(caregiver)/(tabs)');
  }, [router]);

  const lat = sos?.payload.lat ?? null;
  const lng = sos?.payload.lng ?? null;

  return (
    <Screen scroll>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>SOS</Text>
        <Text style={styles.bannerText}>
          {firstName(elder.name)} pediu ajuda{sos ? ` às ${clockTime(sos.at, elder.timezone)}` : ''}.
        </Text>
      </View>

      {events.isError ? <ErrorState message={friendlyError(events.error)} onRetry={() => void events.refetch()} /> : null}

      {lat !== null && lng !== null ? (
        <Button title="Abrir localização no mapa" variant="secondary" onPress={() => void Linking.openURL(mapsUrl(lat, lng))} />
      ) : sos ? (
        <Text style={styles.noPosition}>O celular não conseguiu enviar a localização.</Text>
      ) : null}

      {contacts.isPending ? <LoadingState /> : null}
      {contacts.isError ? <ErrorState message={friendlyError(contacts.error)} onRetry={() => void contacts.refetch()} /> : null}
      {contacts.data && ordered.length === 0 ? (
        <Text style={styles.noPosition}>Nenhum contato cadastrado. Cadastre no Perfil para ligar daqui.</Text>
      ) : null}
      {ordered.map((contact) => (
        <Card key={contact.id}>
          <Text style={styles.contactName}>{contact.name}</Text>
          <Text style={styles.contactRelation}>{contact.relation} · {formatPhone(contact.phone)}</Text>
          <Button title={`Ligar para ${contact.name}`} variant="secondary" onPress={() => void Linking.openURL(`tel:${contact.phone}`)} />
        </Card>
      ))}

      <Button title="Estou a caminho" onPress={leave} />
      <Button title="Ver histórico" variant="ghost" onPress={() => router.replace('/(caregiver)/(tabs)/history')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: Colors.dangerHeader, borderRadius: 16, padding: Spacing.xxl, gap: Spacing.sm },
  bannerTitle: { color: Colors.white, fontSize: Typography.size.xxl, fontWeight: Typography.weight.bold },
  bannerText: { color: Colors.dangerBg, fontSize: Typography.size.lg },
  contactName: { fontSize: Typography.size.lg, fontWeight: Typography.weight.semibold, color: Colors.textPrimary },
  contactRelation: { fontSize: Typography.size.base, color: Colors.textSecondary },
  noPosition: { fontSize: Typography.size.base, color: Colors.textSecondary },
});
