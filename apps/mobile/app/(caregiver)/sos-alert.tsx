import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { useMe } from '@/auth/useMe';
import { Button, Card, LoadingState, Screen } from '@/components';
import { api } from '@/lib/backend';
import { queryKeys } from '@/lib/query';
import { Colors, Spacing, Typography } from '@/theme';

/** Opened by the SOS push: who asked for help, when, and the numbers to call. */
export default function SosAlertScreen() {
  const router = useRouter();
  const { elderId, eventId } = useLocalSearchParams<{ elderId?: string; eventId?: string }>();
  const me = useMe();
  const elderName = me.data?.role === 'caregiver' ? me.data.elders.find((e) => e.id === elderId)?.name : undefined;

  const events = useQuery({
    queryKey: queryKeys.events(elderId ?? '', { types: ['sos'], limit: 5 }),
    queryFn: () => api.listEvents(elderId ?? '', { types: ['sos'], limit: 5 }),
    enabled: Boolean(elderId),
  });
  const contacts = useQuery({
    queryKey: queryKeys.contacts(elderId ?? ''),
    queryFn: () => api.listContacts(elderId ?? ''),
    enabled: Boolean(elderId),
  });

  const event = events.data?.items.find((e) => e.id === eventId) ?? events.data?.items[0];
  const when = event ? new Date(event.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <Screen scroll>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>SOS</Text>
        <Text style={styles.bannerText}>
          {elderName ?? 'O idoso'} pediu ajuda{when ? ` às ${when}` : ''}.
        </Text>
      </View>

      {contacts.isPending ? <LoadingState /> : null}
      {contacts.data?.items.map((contact) => (
        <Card key={contact.id}>
          <Text style={styles.contactName}>{contact.name}</Text>
          <Text style={styles.contactRelation}>{contact.relation}</Text>
          <Button title={`Ligar para ${contact.name}`} variant="secondary" onPress={() => void Linking.openURL(`tel:${contact.phone}`)} />
        </Card>
      ))}

      <Button title="Ver histórico" onPress={() => router.replace('/(caregiver)/(tabs)/history')} />
      <Button title="Fechar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: Colors.dangerHeader, borderRadius: 16, padding: Spacing.xxl, gap: Spacing.sm },
  bannerTitle: { color: Colors.white, fontSize: Typography.size.xxl, fontWeight: Typography.weight.bold },
  bannerText: { color: Colors.dangerBg, fontSize: Typography.size.lg },
  contactName: { fontSize: Typography.size.lg, fontWeight: Typography.weight.semibold, color: Colors.textPrimary },
  contactRelation: { fontSize: Typography.size.base, color: Colors.textSecondary },
});
