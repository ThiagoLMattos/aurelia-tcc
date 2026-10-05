import { Redirect } from 'expo-router';

import { useSession } from '@/auth/SessionProvider';

/** Entry point: sends each visitor to their side of the app. Nothing is drawn while the session loads (the native splash is up). */
export default function Index() {
  const { status, role } = useSession();
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/(auth)/welcome" />;
  return <Redirect href={role === 'elder' ? '/(elder)' : '/(caregiver)/(tabs)'} />;
}
