import type { Contact } from '@aurelia/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton, ElderHeader, type Section } from '@/elder/ui';
import { raiseSos, useSosStatus } from '@/elder/sosService';
import type { SosStatus } from '@/elder/sos';
import { dialable } from '@/elder/phones';
import { formatPhone } from '@/lib/format';
import { useContacts, useElderSelf } from '@/queries';
import { PatientColors, PatientTypography } from '@/theme';

const SECTION: Section = {
  main: PatientColors.sosMain,
  headerButton: PatientColors.sosHeaderButton,
  border: PatientColors.sosHeaderBorder,
  text: PatientColors.sosHeaderText,
};

const SAMU = { name: 'SAMU', phone: '192' };

const STATUS_TEXT: Record<SosStatus, string> = {
  idle: 'Avisando sua família…',
  sending: 'Avisando sua família…',
  retrying: 'Sem internet agora. Vamos continuar tentando. Ligue já!',
  sent: 'Sua família foi avisada.',
  failed: 'Não foi possível avisar sua família. Ligue já!',
};

function dial(phone: string) {
  void Linking.openURL(`tel:${dialable(phone)}`);
}

/**
 * Opening this screen IS the alarm: the position (if it comes quickly) and the SOS request go out in the
 * background and are retried, while the screen offers the phone call right away, never waiting on either.
 */
export default function SosElderScreen() {
  const router = useRouter();
  const elder = useElderSelf();
  const contacts = useContacts(elder.id);
  const status = useSosStatus();
  const raised = useRef(false);

  useEffect(() => {
    if (raised.current) return;
    raised.current = true;
    raiseSos(elder.id);
  }, [elder.id]);

  const emergency = useMemo<Contact[]>(() => (contacts.data?.items ?? []).filter((c) => c.isEmergency), [contacts.data]);
  const [first, ...others] = emergency;
  const alarming = status === 'retrying' || status === 'failed';

  return (
    <SafeAreaView style={styles.container}>
      <ElderHeader title="SOS" section={SECTION} onBack={() => router.back()} titleSize={50} />

      <View style={[styles.status, alarming && styles.statusAlarm]} accessibilityLiveRegion="polite">
        <Text style={styles.statusText}>{STATUS_TEXT[status]}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {first ? (
          <>
            <Text style={styles.label}>LIGAR PARA:</Text>
            <BigButton
              label={`${first.name}${first.relation ? ` — ${first.relation}` : ''}`}
              accessibilityLabel={`Ligar para ${first.name}`}
              onPress={() => dial(first.phone)}
              color={PatientColors.sosMain}
              textColor={PatientColors.sosHeaderText}
              style={styles.callPrimary}
            />
            <Text style={styles.phone}>{formatPhone(first.phone)}</Text>
          </>
        ) : (
          <Text style={styles.empty}>
            {contacts.isPending
              ? 'Buscando seus contatos…'
              : 'Nenhum contato de emergência cadastrado. Peça ao seu cuidador para cadastrar.'}
          </Text>
        )}

        {others.map((contact) => (
          <View key={contact.id} style={styles.contactCard}>
            <Image source={require('../../assets/images/ContatoSOS.png')} style={styles.avatar} resizeMode="cover" />
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{contact.name}{contact.relation ? ` — ${contact.relation}` : ''}</Text>
              <Text style={styles.contactPhone}>{formatPhone(contact.phone)}</Text>
            </View>
            <BigButton
              label="LIGAR"
              accessibilityLabel={`Ligar para ${contact.name}`}
              onPress={() => dial(contact.phone)}
              color={PatientColors.sosMain}
              textColor={PatientColors.sosHeaderText}
              style={styles.callSmall}
            />
          </View>
        ))}

        <BigButton
          label="LIGAR 192 — SAMU"
          accessibilityLabel="Ligar para o SAMU, número 192"
          onPress={() => dial(SAMU.phone)}
          color={PatientColors.sosHeaderButton}
          textColor={PatientColors.sosHeaderText}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PatientColors.sosBg },
  status: { backgroundColor: '#FFFFFF', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: PatientColors.sosBorder },
  statusAlarm: { backgroundColor: PatientColors.sosTextEmphasis },
  statusText: { fontSize: PatientTypography.size.reduced, fontWeight: PatientTypography.weight.bold, color: PatientColors.sosText, textAlign: 'center' },
  content: { padding: 20, gap: 16 },
  label: { fontSize: PatientTypography.size.sheet, color: PatientColors.sosText, textAlign: 'center' },
  callPrimary: { minHeight: 110, backgroundColor: PatientColors.sosMain },
  phone: { fontSize: PatientTypography.size.reduced, color: PatientColors.sosText, textAlign: 'center', fontWeight: PatientTypography.weight.bold },
  empty: { fontSize: PatientTypography.size.common, color: PatientColors.sosText, textAlign: 'center', lineHeight: PatientTypography.size.common * PatientTypography.lineHeight.normal },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: PatientColors.sosBorder, padding: 12, backgroundColor: PatientColors.sosBg },
  avatar: { width: 70, height: 70 },
  contactInfo: { flex: 1 },
  contactName: { fontSize: PatientTypography.size.reduced, fontWeight: PatientTypography.weight.bold, color: PatientColors.sosTextEmphasis },
  contactPhone: { fontSize: PatientTypography.size.reduced, color: PatientColors.sosText },
  callSmall: { minHeight: 64, minWidth: 110, paddingHorizontal: 10 },
});
