import { SignupBodySchema } from '@aurelia/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useSession } from '@/auth/SessionProvider';
import { Button, FormError, Logo, Screen, TextField } from '@/components';
import { api } from '@/lib/backend';
import { friendlyError } from '@/lib/errors';
import { validateForm } from '@/lib/forms';
import { Colors, Typography } from '@/theme';

export default function SignupScreen() {
  const router = useRouter();
  const { signInWithPassword } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitError(null);
    const result = validateForm(
      SignupBodySchema,
      { name, email: email.trim(), password },
      { name: 'Informe seu nome.', email: 'Informe um e-mail válido.', password: 'A senha precisa ter ao menos 8 caracteres.' },
    );
    setErrors(result.ok ? {} : result.errors);
    if (!result.ok) return;

    setSubmitting(true);
    try {
      await api.signup(result.data);
      // The server created the account; signing in is what starts the session (and moves us on).
      await signInWithPassword(result.data.email, result.data.password);
    } catch (error) {
      setSubmitError(friendlyError(error));
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll centered>
      <Logo />
      <Text style={styles.title}>Criar conta de cuidador</Text>
      <TextField label="Seu nome" value={name} onChangeText={setName} error={errors.name} autoComplete="name" autoCapitalize="words" />
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
      <TextField
        label="Senha"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="new-password"
        placeholder="Mínimo de 8 caracteres"
      />
      <FormError message={submitError} />
      <Button title="Criar conta" onPress={submit} loading={submitting} />
      <Pressable onPress={() => router.replace('/(auth)/login')} accessibilityRole="link">
        <Text style={styles.link}>Já tenho conta</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, color: Colors.textPrimary, textAlign: 'center' },
  link: { textAlign: 'center', color: Colors.primary, fontSize: Typography.size.md, fontWeight: Typography.weight.semibold },
});
