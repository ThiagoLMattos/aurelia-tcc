import { Stack } from 'expo-router';

import { useSession } from '@/auth/SessionProvider';
import { useMe } from '@/auth/useMe';
import { Button, ErrorState, LoadingState, Screen } from '@/components';
import { friendlyError } from '@/lib/errors';

/**
 * The caregiver side. Whether they see the tabs or the "create your first elder" step depends on
 * what `GET /me` says they are responsible for.
 */
export default function CaregiverLayout() {
  const me = useMe();
  const { signOut } = useSession();

  if (!me.data) {
    return (
      <Screen>
        {me.isError ? (
          <>
            <ErrorState message={friendlyError(me.error)} onRetry={() => void me.refetch()} />
            <Button title="Sair" variant="ghost" onPress={() => void signOut()} />
          </>
        ) : (
          <LoadingState />
        )}
      </Screen>
    );
  }

  const hasElder = me.data.role === 'caregiver' && me.data.elders.length > 0;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={hasElder}>
        <Stack.Screen name="(tabs)" />
        {/* Routine builder: slides up from the bottom */}
        <Stack.Screen name="routine-builder" options={{ presentation: 'modal', gestureEnabled: true }} />
        {/* Geo-fence breach and SOS alert: full screen, NOT gesture-dismissable (deliberate safety pattern) */}
        <Stack.Screen name="geo-fence-breach" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="sos-alert" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="settings" options={{ presentation: 'card' }} />
        <Stack.Screen name="pair-elder" options={{ presentation: 'card' }} />
        <Stack.Screen name="invite-caregiver" options={{ presentation: 'card' }} />
        <Stack.Screen name="safe-zone" options={{ presentation: 'card' }} />
        <Stack.Screen name="location" options={{ presentation: 'card' }} />
        <Stack.Screen name="tracker" options={{ presentation: 'card' }} />
      </Stack.Protected>
      <Stack.Protected guard={!hasElder}>
        <Stack.Screen name="onboarding/create-elder" />
      </Stack.Protected>
    </Stack>
  );
}
