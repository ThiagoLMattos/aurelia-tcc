import { PairBodySchema, PAIRING_CODE_LENGTH } from '@aurelia/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useSession } from '@/auth/SessionProvider';
import { Button, FormError, Logo, Screen, TextField } from '@/components';
import { api } from '@/lib/backend';
import { friendlyError } from '@/lib/errors';
import { validateForm } from '@/lib/forms';
import { palette, PatientTypography } from '@/theme';

export default function PairScreen() {
  const router = useRouter();
  const { signInWithCustomToken } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitError(null);
    const result = validateForm(PairBodySchema, { code }, { code: `O código tem ${PAIRING_CODE_LENGTH} letras e números.` });
    setError(result.ok ? undefined : result.errors.code);
    if (!result.ok) return;

    setSubmitting(true);
    try {
      const { customToken } = await api.pair(result.data);
      await signInWithCustomToken(customToken);
    } catch (e) {
      setSubmitError(friendlyError(e));
      setSubmitting(false);
    }
  }

  return (
    <Screen role="elder" scroll centered>
      <Logo size={96} />
      <Text style={[styles.title, { color: palette.elder.primary }]}>Parear este celular</Text>
      <Text style={styles.help}>Peça ao seu cuidador o código que aparece no aplicativo dele e digite aqui.</Text>
      <TextField
        role="elder"
        label="Código"
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        error={error}
        maxLength={PAIRING_CODE_LENGTH}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
      />
      <FormError role="elder" message={submitError} />
      <Button role="elder" title="Parear" onPress={submit} loading={submitting} />
      <Button role="elder" title="Voltar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: PatientTypography.size.header, fontWeight: '700', lineHeight: PatientTypography.size.header * 1.2 },
  help: { fontSize: PatientTypography.size.common, color: palette.elder.text, lineHeight: PatientTypography.size.common * PatientTypography.lineHeight.tight },
});
