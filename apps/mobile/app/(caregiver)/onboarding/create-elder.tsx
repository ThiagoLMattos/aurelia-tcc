import { CreateElderBodySchema, DiagnosisStageSchema, JoinElderBodySchema, LABELS_PT, type DiagnosisStage } from '@aurelia/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/auth/SessionProvider';
import { Button, FormError, Screen, TextField } from '@/components';
import { api } from '@/lib/backend';
import { friendlyError } from '@/lib/errors';
import { brDateToIso, maskBrDate, validateForm } from '@/lib/forms';
import { queryKeys } from '@/lib/query';
import { Colors, Radius, Spacing, Typography } from '@/theme';

/** Joining an elder another caregiver already follows, with the invite they sent. */
function JoinWithInvite({ onCancel }: { onCancel: () => void }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    const parsed = JoinElderBodySchema.safeParse({ code });
    if (!parsed.success) {
      setError('O código tem 6 letras e números.');
      return;
    }
    setSubmitting(true);
    try {
      await api.joinElder(parsed.data);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    } catch (joinError) {
      setError(friendlyError(joinError));
      setSubmitting(false);
    }
  }

  return (
    <>
      <Text style={styles.title}>Entrar com um convite</Text>
      <Text style={styles.help}>Digite o código que outro cuidador enviou para você.</Text>
      <TextField
        label="Código do convite"
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        placeholder="ABC234"
      />
      <FormError message={error} />
      <Button title="Entrar" onPress={submit} loading={submitting} />
      <Button title="Voltar" variant="ghost" onPress={onCancel} />
    </>
  );
}

/** Shown to a caregiver who has no elder yet; the tabs unlock as soon as `GET /me` lists one. */
export default function CreateElderScreen() {
  const queryClient = useQueryClient();
  const { signOut } = useSession();
  const [joining, setJoining] = useState(false);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [stage, setStage] = useState<DiagnosisStage>('early');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitError(null);
    const result = validateForm(
      CreateElderBodySchema,
      { name, birthDate: brDateToIso(birthDate), diagnosisStage: stage },
      { name: 'Informe o nome.', birthDate: 'Informe uma data válida (DD/MM/AAAA).', diagnosisStage: 'Escolha o estágio.' },
    );
    setErrors(result.ok ? {} : result.errors);
    if (!result.ok) return;

    setSubmitting(true);
    try {
      await api.createElder(result.data);
      // Refetching /me is what flips the layout from this step to the tabs.
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    } catch (error) {
      setSubmitError(friendlyError(error));
      setSubmitting(false);
    }
  }

  if (joining) {
    return (
      <Screen scroll centered>
        <JoinWithInvite onCancel={() => setJoining(false)} />
      </Screen>
    );
  }

  return (
    <Screen scroll centered>
      <Text style={styles.title}>Quem você cuida?</Text>
      <Text style={styles.help}>Cadastre a pessoa de quem você cuida. Você pode mudar isso depois.</Text>

      <TextField label="Nome" value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" />
      <TextField
        label="Data de nascimento"
        value={birthDate}
        onChangeText={(text) => setBirthDate(maskBrDate(text))}
        error={errors.birthDate}
        keyboardType="number-pad"
        placeholder="DD/MM/AAAA"
        maxLength={10}
      />

      <View style={styles.stages}>
        <Text style={styles.label}>Estágio do diagnóstico</Text>
        <View style={styles.chips}>
          {DiagnosisStageSchema.options.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: stage === option }}
              onPress={() => setStage(option)}
              style={[styles.chip, stage === option && styles.chipSelected]}
            >
              <Text style={[styles.chipText, stage === option && styles.chipTextSelected]}>{LABELS_PT.diagnosisStage[option]}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FormError message={submitError} />
      <Button title="Continuar" onPress={submit} loading={submitting} />
      <Button title="Tenho um código de convite" variant="secondary" onPress={() => setJoining(true)} />
      <Button title="Sair" variant="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, color: Colors.textPrimary },
  help: { fontSize: Typography.size.md, color: Colors.textSecondary },
  label: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold, color: Colors.textPrimary },
  stages: { gap: Spacing.sm },
  chips: { flexDirection: 'row', gap: Spacing.sm },
  chip: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  chipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipText: { fontSize: Typography.size.base, color: Colors.textSecondary },
  chipTextSelected: { color: Colors.primaryDark, fontWeight: Typography.weight.semibold },
});
