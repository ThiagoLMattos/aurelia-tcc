import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Logo, Screen } from '@/components';
import { env } from '@/config/env';
import { MOCK_DEMO_EMAIL, MOCK_DEMO_PAIRING_CODE, MOCK_DEMO_PASSWORD } from '@/lib/api/mock';
import { Colors, Spacing, Typography } from '@/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <Screen centered>
      <View style={styles.header}>
        <Logo size={120} />
        <Text style={styles.title}>Aurélia</Text>
        <Text style={styles.subtitle}>Cuidado com carinho, de pertinho.</Text>
      </View>

      <Button title="Sou cuidador" onPress={() => router.push('/(auth)/login')} />
      <Button title="Sou o idoso (parear este celular)" variant="secondary" onPress={() => router.push('/(auth)/pair')} />

      {env.apiMode === 'mock' ? (
        <View style={styles.demo}>
          <Text style={styles.demoText}>Modo demonstração, sem servidor.</Text>
          <Text style={styles.demoText}>
            Cuidador: {MOCK_DEMO_EMAIL} / {MOCK_DEMO_PASSWORD}
          </Text>
          <Text style={styles.demoText}>Código do idoso: {MOCK_DEMO_PAIRING_CODE}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xxl },
  title: { fontSize: Typography.size.xxl, fontWeight: Typography.weight.bold, color: Colors.primary },
  subtitle: { fontSize: Typography.size.md, color: Colors.textSecondary },
  demo: { marginTop: Spacing.xxl, gap: Spacing.xs, alignItems: 'center' },
  demoText: { fontSize: Typography.size.sm, color: Colors.textMuted },
});
