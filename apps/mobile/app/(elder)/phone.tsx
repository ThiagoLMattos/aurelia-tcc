import type { Contact } from '@aurelia/shared';
import * as Contacts from 'expo-contacts';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton, ElderHeader, MIN_TOUCH, Sheet, SheetText, type Section } from '@/elder/ui';
import { dialable, phoneKey } from '@/elder/phones';
import { formatPhone } from '@/lib/format';
import { useContacts, useElderSelf } from '@/queries';
import { PatientColors, PatientTypography } from '@/theme';
import { withTap } from '@/sound';

const SECTION: Section = {
  main: PatientColors.phoneMain,
  headerButton: PatientColors.phoneHeaderButton,
  border: PatientColors.phoneHeaderBorder,
  text: PatientColors.phoneHeaderText,
};

/** A row of the list: someone the caregiver registered (pinned on top) or a contact of this phone. */
interface Entry {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

type LoadState = 'loading' | 'ready' | 'denied' | 'error';

export default function PhoneElderScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const selecting = mode === 'select';
  const elder = useElderSelf();
  const api = useContacts(elder.id);

  const [device, setDevice] = useState<Entry[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [selected, setSelected] = useState<Entry | null>(null);

  const loadDeviceContacts = useCallback(async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') return setState('denied');
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
      setDevice(
        data.flatMap((item) => {
          const number = item.phoneNumbers?.[0]?.number;
          if (!item.id || !number) return [];
          const name = item.name || `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim() || 'Contato sem nome';
          return [{ id: item.id, name, phone: number, relation: '' }];
        }),
      );
      setState('ready');
    } catch (error) {
      console.warn('[phone] não foi possível ler os contatos', error);
      setState('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDeviceContacts();
    }, [loadDeviceContacts]),
  );

  const registered = useMemo<Entry[]>(
    () => (api.data?.items ?? []).map((c: Contact) => ({ id: c.id, name: c.name, phone: c.phone, relation: c.relation })),
    [api.data],
  );

  // A phone contact that the caregiver (or the elder) registered shows its relation too.
  const sections = useMemo(() => {
    const relationByPhone = new Map(registered.map((c) => [phoneKey(c.phone), c.relation]));
    const phoneBook = device
      .map((c) => ({ ...c, relation: relationByPhone.get(phoneKey(c.phone)) ?? '' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return [
      ...(!selecting && registered.length > 0 ? [{ title: 'MEUS CONTATOS', data: registered }] : []),
      { title: selecting ? '' : 'CONTATOS DO TELEFONE', data: phoneBook },
    ];
  }, [registered, device, selecting]);

  function pick(entry: Entry) {
    if (selecting) {
      router.dismissTo({
        pathname: '/(elder)/add-contact',
        params: { selectedId: entry.id, selectedName: entry.name, selectedPhone: entry.phone },
      });
      return;
    }
    setSelected(entry);
  }

  function call() {
    if (!selected) return;
    void Linking.openURL(`tel:${dialable(selected.phone)}`);
    setSelected(null);
  }

  const emptyMessage =
    state === 'denied'
      ? 'Sem acesso aos contatos do telefone. Libere nas configurações do aparelho.'
      : state === 'error'
        ? 'Não foi possível ler os contatos do telefone.'
        : 'Nenhum contato disponível.';

  return (
    <SafeAreaView style={styles.container}>
      <ElderHeader title={selecting ? 'SELECIONAR CONTATO' : 'TELEFONE'} section={SECTION} onBack={() => router.back()} />

      {state === 'loading' && registered.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PatientColors.phoneMain} />
          <Text style={styles.loadingText}>Carregando contatos…</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null)}
          renderItem={({ item }) => (
            <Pressable
              style={styles.contactCard}
              onPress={withTap(() => pick(item))}
              accessibilityRole="button"
              accessibilityLabel={selecting ? `Escolher ${item.name}` : `Ligar para ${item.name}${item.relation ? `, ${item.relation}` : ''}`}
            >
              <Image source={require('../../assets/images/ContatoTelefone.png')} style={styles.avatar} resizeMode="cover" />
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{item.name}{item.relation ? ` — ${item.relation}` : ''}</Text>
                <Text style={styles.contactPhone}>{formatPhone(item.phone)}</Text>
              </View>
            </Pressable>
          )}
          ListFooterComponent={
            state === 'denied' || state === 'error' || (state === 'ready' && sections.every((s) => s.data.length === 0)) ? <Text style={styles.empty}>{emptyMessage}</Text> : null
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      )}

      {!selecting && (
        <View style={styles.footer}>
          <BigButton
            label="+ ADICIONAR CONTATO"
            onPress={withTap(() => router.push('/(elder)/add-contact'))}
            color={PatientColors.phoneHeaderButton}
            textColor={PatientColors.phoneHeaderText}
            style={styles.footerButton}
          />
        </View>
      )}

      <Sheet visible={selected !== null} onClose={() => setSelected(null)} accent={PatientColors.phoneMain}>
        <SheetText>Certeza que deseja ligar para:</SheetText>
        <SheetText strong>{selected?.name}{selected?.relation ? ` — ${selected.relation}` : ''}</SheetText>
        <BigButton label="LIGAR" onPress={call} color={PatientColors.phoneMain} textColor={PatientColors.phoneHeaderText} />
        <BigButton label="VOLTAR" onPress={() => setSelected(null)} color={PatientColors.phoneHeaderButton} textColor={PatientColors.phoneHeaderText} />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PatientColors.phoneMain },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF' },
  loadingText: { fontSize: PatientTypography.size.common, color: '#2C2C2C' },
  list: { paddingBottom: 16, backgroundColor: '#FFFFFF', flexGrow: 1 },
  sectionTitle: {
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.bold,
    color: PatientColors.phoneHeaderText,
    backgroundColor: PatientColors.phoneHeaderButton,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  contactCard: {
    minHeight: MIN_TOUCH,
    borderWidth: 0.5,
    borderColor: PatientColors.phoneFieldBorder,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: { width: 100, height: 100 },
  contactInfo: { flex: 1 },
  contactName: { fontSize: PatientTypography.size.common, fontWeight: PatientTypography.weight.bold, color: '#2C2C2C', marginBottom: 4 },
  contactPhone: { fontSize: PatientTypography.size.reduced, fontWeight: PatientTypography.weight.bold, color: '#2C2C2C' },
  empty: { fontSize: PatientTypography.size.common, color: '#2C2C2C', textAlign: 'center', padding: 32 },
  footer: { backgroundColor: PatientColors.phoneMain, padding: 16, borderTopWidth: 0.5, borderTopColor: '#D3D1C7' },
  footerButton: { borderColor: PatientColors.phoneHeaderBorder, borderWidth: 1 },
});
