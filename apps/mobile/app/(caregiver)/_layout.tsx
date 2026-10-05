import { Stack } from 'expo-router';

import { useSession } from '@/auth/SessionProvider';
import { useMe } from '@/auth/useMe';
import { Button, ErrorState, LoadingState, Screen } from '@/components';
import { AppProvider } from '@/context/AppContext';
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
    // AppProvider is the old mock-backed state the existing screens still read; the caregiver
    // screens move to the API client one by one and it goes away with the last of them.
    <AppProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={hasElder}>
          <Stack.Screen name="(tabs)" />
          {/* Routine builder: slides up from the bottom */}
          <Stack.Screen name="routine-builder" options={{ presentation: 'modal', gestureEnabled: true }} />
          {/* Geo-fence breach and SOS alert: full screen, NOT gesture-dismissable (deliberate safety pattern) */}
          <Stack.Screen name="geo-fence-breach" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="sos-alert" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="settings" options={{ presentation: 'card' }} />
        </Stack.Protected>
        <Stack.Protected guard={!hasElder}>
          <Stack.Screen name="onboarding/create-elder" />
        </Stack.Protected>
      </Stack>
    </AppProvider>
  );
}
