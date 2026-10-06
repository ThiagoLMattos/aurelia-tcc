import { SignupBodySchema } from '@aurelia/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useSession } from '@/auth/SessionProvider';
import { Button, FormError, Logo, Screen, TextField } from '@/components';
import { friendlyError } from '@/lib/errors';
import { validateForm } from '@/lib/forms';
import { Colors, Typography } from '@/theme';

// Only the shape of the credentials is checked here; the real verdict comes from the server.
const LoginSchema = SignupBodySchema.pick({ email: true }).extend({ password: SignupBodySchema.shape.password.min(1) });

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithPassword, sendPasswordReset } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  // "Esqueci minha senha": Firebase e-mails a link to choose a new one, to the address typed above.
  async function forgotPassword() {
    setSubmitError(null);
    setResetSentTo(null);
    const result = validateForm(LoginSchema.pick({ email: true }), { email: email.trim() }, { email: 'Digite seu e-mail acima para receber o link.' });
    setErrors(result.ok ? {} : result.errors);
    if (!result.ok) return;

    setSendingReset(true);
    try {
      await sendPasswordReset(result.data.email);
      setResetSentTo(result.data.email);
    } catch (error) {
      setSubmitError(friendlyError(error));
    } finally {
      setSendingReset(false);
    }
  }

  async function submit() {
    setSubmitError(null);
    const result = validateForm(LoginSchema, { email: email.trim(), password }, { email: 'Informe um e-mail válido.', password: 'Informe a senha.' });
    setErrors(result.ok ? {} : result.errors);
    if (!result.ok) return;

    setSubmitting(true);
    try {
      await signInWithPassword(result.data.email, result.data.password);
    } catch (error) {
      setSubmitError(friendlyError(error));
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll centered>
      <Logo />
      <Text style={styles.title}>Entrar</Text>
      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
      />
      <TextField label="Senha" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry autoComplete="current-password" />
      <FormError message={submitError} />
      {resetSentTo ? (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          Se houver uma conta com {resetSentTo}, enviamos um link para criar uma nova senha. Confira também a caixa de spam.
        </Text>
      ) : null}
      <Button title="Entrar" onPress={submit} loading={submitting} />
      <Pressable onPress={() => void forgotPassword()} disabled={sendingReset} accessibilityRole="button">
        <Text style={[styles.link, styles.secondaryLink]}>{sendingReset ? 'Enviando…' : 'Esqueci minha senha'}</Text>
      </Pressable>
      <Pressable onPress={() => router.replace('/(auth)/signup')} accessibilityRole="link">
        <Text style={styles.link}>Ainda não tenho conta</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, color: Colors.textPrimary, textAlign: 'center' },
  link: { textAlign: 'center', color: Colors.primary, fontSize: Typography.size.md, fontWeight: Typography.weight.semibold },
  secondaryLink: { fontWeight: Typography.weight.regular },
  notice: { color: Colors.successText, backgroundColor: Colors.successBg, padding: 12, borderRadius: 10, fontSize: Typography.size.base, lineHeight: 20 },
});
