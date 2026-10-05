import { SignupBodySchema } from '@aurelia/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useSession } from '@/auth/SessionProvider';
import { Button, FormError, Screen, TextField } from '@/components';
import { friendlyError } from '@/lib/errors';
import { validateForm } from '@/lib/forms';
import { Colors, Typography } from '@/theme';

// Only the shape of the credentials is checked here; the real verdict comes from the server.
const LoginSchema = SignupBodySchema.pick({ email: true }).extend({ password: SignupBodySchema.shape.password.min(1) });

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithPassword } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      <Button title="Entrar" onPress={submit} loading={submitting} />
      <Pressable onPress={() => router.replace('/(auth)/signup')} accessibilityRole="link">
        <Text style={styles.link}>Ainda não tenho conta</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, color: Colors.textPrimary },
  link: { textAlign: 'center', color: Colors.primary, fontSize: Typography.size.md, fontWeight: Typography.weight.semibold },
});
