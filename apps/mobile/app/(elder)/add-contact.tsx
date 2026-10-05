import { CreateContactBodySchema, MAX_EMERGENCY_CONTACTS } from '@aurelia/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton, ElderHeader, MIN_TOUCH, Sheet, SheetText, type Section } from '@/elder/ui';
import { friendlyError } from '@/lib/errors';
import { formatPhone } from '@/lib/format';
import { useContacts, useCreateContact, useElderSelf } from '@/queries';
import { PatientColors, PatientTypography } from '@/theme';

const SECTION: Section = {
  main: PatientColors.phoneMain,
  headerButton: PatientColors.phoneHeaderButton,
  border: PatientColors.phoneHeaderBorder,
  text: PatientColors.phoneHeaderText,
};

const RELATIONS = [
  'FILHO', 'FILHA', 'MARIDO', 'ESPOSA',
  'IRMÃO', 'IRMÃ', 'NETO', 'NETA',
  'GENRO', 'NORA', 'CUNHADO', 'CUNHADA',
  'PAI', 'MÃE', 'CUIDADOR', 'CUIDADORA',
  'MÉDICO', 'MÉDICA', 'VIZINHO', 'VIZINHA',
  'AMIGO', 'AMIGA', 'OUTRO',
];

type Step = 'relations' | 'custom' | 'confirm' | 'emergency' | 'error' | null;

/** 'FILHA' → 'Filha', the way the caregiver app writes relations. */
function sentenceCase(text: string): string {
  const lower = text.trim().toLocaleLowerCase('pt-BR');
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
}

export default function AddContactElderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ selectedId?: string; selectedName?: string; selectedPhone?: string }>();
  const elder = useElderSelf();
  const contacts = useContacts(elder.id);
  const create = useCreateContact(elder.id);

  const [relation, setRelation] = useState('');
  const [customRelation, setCustomRelation] = useState('');
  const [step, setStep] = useState<Step>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const name = params.selectedName ?? '';
  const phone = params.selectedPhone ?? '';
  const emergencyCount = (contacts.data?.items ?? []).filter((c) => c.isEmergency).length;
  const emergencyFull = emergencyCount >= MAX_EMERGENCY_CONTACTS;

  function pickRelation(value: string) {
    if (value === 'OUTRO') return setStep('custom');
    setRelation(value);
    setStep(null);
  }

  function confirmCustom() {
    if (!customRelation.trim()) return;
    setRelation(customRelation.trim().toLocaleUpperCase('pt-BR'));
    setStep(null);
  }

  function start() {
    if (!name) return Alert.alert('Atenção', 'Selecione um contato.');
    if (!relation) return Alert.alert('Atenção', 'Selecione um parentesco.');
    setStep('confirm');
  }

  function save(isEmergency: boolean) {
    const parsed = CreateContactBodySchema.safeParse({ name, phone, relation: sentenceCase(relation), isEmergency });
    if (!parsed.success) {
      setErrorMessage('Não conseguimos usar o número deste contato. Escolha outro.');
      return setStep('error');
    }
    create.mutate(parsed.data, {
      onSuccess: () => router.back(),
      onError: (error) => {
        setErrorMessage(friendlyError(error));
        setStep('error');
      },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ElderHeader title="ADICIONAR CONTATO" section={SECTION} onBack={() => router.back()} titleSize={PatientTypography.size.common} />

      <View style={styles.form}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Contato</Text>
          <Pressable
            style={styles.selectButton}
            onPress={() => router.push({ pathname: '/(elder)/phone', params: { mode: 'select' } })}
            accessibilityRole="button"
            accessibilityLabel="Escolher um contato do telefone"
          >
            <Text style={[styles.selectButtonText, !name && styles.placeholder]}>{name || 'APERTE PARA SELECIONAR'}</Text>
          </Pressable>
          {phone ? <Text style={styles.selectedPhone}>{formatPhone(phone)}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Parentesco</Text>
          <Pressable style={styles.selectButton} onPress={() => setStep('relations')} accessibilityRole="button" accessibilityLabel="Escolher o parentesco">
            <Text style={[styles.selectButtonText, !relation && styles.placeholder]}>{relation || 'APERTE PARA SELECIONAR'}</Text>
          </Pressable>
        </View>

        <BigButton label="ADICIONAR" onPress={start} disabled={!name || !relation} color={PatientColors.phoneMain} textColor={PatientColors.phoneHeaderText} />
      </View>

      <Sheet visible={step === 'relations'} onClose={() => setStep(null)} accent={PatientColors.phoneMain}>
        <SheetText strong>LISTA DE PARENTESCOS</SheetText>
        <FlatList
          data={RELATIONS}
          keyExtractor={(item) => item}
          style={styles.relationList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable style={styles.relationItem} onPress={() => pickRelation(item)} accessibilityRole="button">
              <Text style={styles.relationItemText}>{item}</Text>
            </Pressable>
          )}
        />
        <BigButton label="VOLTAR" onPress={() => setStep(null)} color={PatientColors.phoneHeaderButton} textColor={PatientColors.phoneHeaderText} />
      </Sheet>

      <Sheet visible={step === 'custom'} onClose={() => setStep(null)} accent={PatientColors.phoneMain}>
        <SheetText strong>Qual o parentesco dessa pessoa?</SheetText>
        <TextInput
          style={styles.input}
          value={customRelation}
          onChangeText={setCustomRelation}
          placeholder="Escreva aqui!"
          placeholderTextColor="#5F5E5A"
          maxLength={40}
          autoFocus
          accessibilityLabel="Parentesco"
        />
        <BigButton label="ADICIONAR" onPress={confirmCustom} color={PatientColors.phoneMain} textColor={PatientColors.phoneHeaderText} />
        <BigButton label="CANCELAR" onPress={() => setStep(null)} color={PatientColors.phoneHeaderButton} textColor={PatientColors.phoneHeaderText} />
      </Sheet>

      <Sheet visible={step === 'confirm'} onClose={() => setStep(null)} accent={PatientColors.phoneMain}>
        <SheetText>Confirma o nome e o parentesco:</SheetText>
        <SheetText strong>{name} — {relation}</SheetText>
        <BigButton label="ADICIONAR" onPress={() => setStep('emergency')} color={PatientColors.phoneMain} textColor={PatientColors.phoneHeaderText} />
        <BigButton label="CANCELAR" onPress={() => setStep(null)} color={PatientColors.phoneHeaderButton} textColor={PatientColors.phoneHeaderText} />
      </Sheet>

      <Sheet visible={step === 'emergency'} onClose={() => setStep(null)} accent={PatientColors.sosMain} background={PatientColors.sosBg}>
        <SheetText color={PatientColors.sosText}>Você deseja adicionar essa pessoa como contato de emergência?</SheetText>
        <SheetText strong color={PatientColors.sosTextEmphasis}>{emergencyCount}/{MAX_EMERGENCY_CONTACTS} contatos</SheetText>
        <SheetText strong color={PatientColors.sosText}>{name} — {relation}</SheetText>
        {emergencyFull ? (
          <SheetText color={PatientColors.sosText}>Você já tem {MAX_EMERGENCY_CONTACTS} contatos de emergência. Esta pessoa será adicionada como contato comum.</SheetText>
        ) : (
          <BigButton label="SIM" onPress={() => save(true)} loading={create.isPending} color={PatientColors.sosMain} textColor={PatientColors.sosHeaderText} />
        )}
        <BigButton
          label={emergencyFull ? 'ADICIONAR' : 'NÃO'}
          onPress={() => save(false)}
          loading={create.isPending}
          color={PatientColors.sosHeaderButton}
          textColor={PatientColors.sosHeaderText}
        />
      </Sheet>

      <Sheet visible={step === 'error'} onClose={() => setStep(null)} accent={PatientColors.sosMain} background={PatientColors.sosBg}>
        <SheetText strong color={PatientColors.sosText}>Não foi possível adicionar</SheetText>
        <SheetText color={PatientColors.sosText}>{errorMessage}</SheetText>
        <BigButton label="ENTENDI" onPress={() => setStep(null)} color={PatientColors.sosMain} textColor={PatientColors.sosHeaderText} />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  form: { padding: 24, gap: 24 },
  fieldGroup: { gap: 10 },
  fieldLabel: { fontSize: PatientTypography.size.reduced, fontWeight: PatientTypography.weight.bold, color: '#2C2C2A' },
  selectButton: {
    minHeight: MIN_TOUCH,
    backgroundColor: '#F1EFE8',
    borderWidth: 1.5,
    borderColor: PatientColors.phoneMain,
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectButtonText: { fontSize: PatientTypography.size.reduced, fontWeight: PatientTypography.weight.bold, color: PatientColors.phoneMain },
  placeholder: { color: '#5F5E5A', fontWeight: PatientTypography.weight.regular },
  selectedPhone: { fontSize: PatientTypography.size.reduced, color: '#5F5E5A', paddingLeft: 4 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: PatientColors.phoneFieldBorder,
    borderRadius: 10,
    minHeight: MIN_TOUCH,
    paddingHorizontal: 18,
    fontSize: PatientTypography.size.common,
    color: '#2C2C2A',
  },
  relationList: { maxHeight: 300 },
  relationItem: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#D3D1C7', alignItems: 'center' },
  relationItemText: { fontSize: PatientTypography.size.common, color: '#2C2C2A' },
});
