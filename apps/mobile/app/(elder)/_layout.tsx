import type { Elder } from '@aurelia/shared';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';

import { clearRevoked, useRevoked } from '@/auth/revoked';
import { useSession } from '@/auth/SessionProvider';
import { useMe } from '@/auth/useMe';
import { ErrorState, LoadingState, Screen } from '@/components';
import { BigButton } from '@/elder/ui';
import { clearLegacyElderStorage } from '@/elder/legacy';
import { useElderReminders } from '@/elder/useElderReminders';
import { friendlyError } from '@/lib/errors';
import { palette, PatientTypography } from '@/theme';

/** Shown when this phone was unpaired: there is nothing to retry, only a new code to ask for. */
function SessionEnded() {
  const router = useRouter();
  const { signOut } = useSession();

  async function askForNewCode() {
    clearRevoked();
    await signOut();
    router.replace('/(auth)/pair');
  }

  return (
    <Screen role="elder" centered>
      <Text style={styles.title} accessibilityRole="header">Este celular precisa de um novo código</Text>
      <Text style={styles.text}>Peça ao seu cuidador um novo código e digite aqui.</Text>
      <BigButton label="DIGITAR NOVO CÓDIGO" onPress={() => void askForNewCode()} color={palette.elder.primary} textColor={palette.elder.onPrimary} />
    </Screen>
  );
}

/** Mounted only once `/me` has loaded, so every elder screen can count on having its elder. */
function ElderStack({ elder }: { elder: Elder }) {
  useElderReminders(elder);
  return <Stack screenOptions={{ headerShown: false }} />;
}

/**
 * The elder side: big, simple screens, no tabs, and deliberately no sign-out (a session only ends when
 * the caregiver unpairs the phone). Each screen draws its own header in its section's colours.
 */
export default function ElderLayout() {
  const me = useMe();
  const revoked = useRevoked();

  useEffect(() => {
    void clearLegacyElderStorage();
    return () => clearRevoked();
  }, []);

  if (revoked) return <SessionEnded />;
  if (me.isPending) return <Screen role="elder"><LoadingState role="elder" /></Screen>;
  if (me.isError || me.data.role !== 'elder') {
    return (
      <Screen role="elder">
        <ErrorState role="elder" message={me.isError ? friendlyError(me.error) : undefined} onRetry={() => void me.refetch()} />
      </Screen>
    );
  }
  return <ElderStack elder={me.data.elder} />;
}

const styles = StyleSheet.create({
  title: { fontSize: PatientTypography.size.header, fontWeight: '700', textAlign: 'center', color: palette.elder.primary },
  text: { fontSize: PatientTypography.size.common, textAlign: 'center', color: palette.elder.text },
});
