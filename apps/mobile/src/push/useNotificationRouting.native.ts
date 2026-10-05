import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useSession } from '@/auth/SessionProvider';

import { isReminderData, parsePushData, routeForPush } from './routing';

/**
 * Opens the right screen when a push is tapped. `useLastNotificationResponse` also reports the tap that
 * launched the app from a killed state, so cold starts work too; the tap waits until the session and
 * the navigator are ready, and each notification is handled only once.
 */
export function useNotificationRouting(): void {
  const response = Notifications.useLastNotificationResponse();
  const { status, role } = useSession();
  const router = useRouter();
  const navigationReady = Boolean(useRootNavigationState()?.key);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response || !navigationReady || status !== 'signedIn' || !role) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;

    const content = response.notification.request.content.data;
    if (role === 'elder' && isReminderData(content)) {
      router.push('/(elder)/tasks');
      return;
    }
    const data = parsePushData(content);
    if (!data) return;
    const { pathname, params } = routeForPush(data, role);
    router.push({ pathname, params } as Href);
  }, [response, navigationReady, status, role, router]);
}
