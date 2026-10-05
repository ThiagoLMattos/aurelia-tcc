import { PUSH_CHANNELS } from '@aurelia/shared';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { env } from '@/config/env';
import type { Api } from '@/lib/api/types';

/** The token handed to the API in this run of the app; see `unregisterPush` for after a restart. */
let registeredToken: string | null = null;

/** Show pushes that arrive while the app is open, instead of swallowing them. */
export function configureNotificationHandler(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(PUSH_CHANNELS.reminders, {
    name: 'Lembretes',
    description: 'Tarefas e rotinas',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Android needs the channels to exist before a token is requested, or alerts arrive silently. */
async function createAndroidChannels(): Promise<void> {
  await Notifications.setNotificationChannelAsync(PUSH_CHANNELS.alerts, {
    name: 'Alertas',
    description: 'SOS e saídas da zona segura',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400],
    sound: 'default',
  });
  await ensureReminderChannel();
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Asks for permission, creates the Android channels, gets the Expo push token and hands it to the API.
 * Returns the token, or null when push is not possible here (web, simulator, no permission, no EAS project,
 * or Android in Expo Go). It never throws: missing push must not get in the way of using the app.
 */
export async function registerPush(api: Api): Promise<string | null> {
  if (env.apiMode === 'mock' || Platform.OS === 'web' || !Device.isDevice) return null;
  if (!env.easProjectId) {
    console.warn('[push] EXPO_PUBLIC_EAS_PROJECT_ID não definido; notificações push desativadas.');
    return null;
  }
  try {
    if (Platform.OS === 'android') await createAndroidChannels();
    if (!(await ensureNotificationPermission())) return null;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: env.easProjectId });
    await api.registerPushToken(token);
    registeredToken = token;
    return token;
  } catch (error) {
    console.warn('[push] não foi possível registrar o token', error);
    return null;
  }
}

/**
 * Removes this phone's token from the account that is about to sign out. The token is not persisted:
 * after a restart it is asked for again, which gives the same token for this installation. With no
 * permission (or no push here) nothing was registered, so there is nothing to remove.
 */
export async function unregisterPush(api: Api): Promise<void> {
  const token = registeredToken ?? (await currentToken());
  if (!token) return;
  await api.unregisterPushToken(token);
  registeredToken = null;
}

async function currentToken(): Promise<string | null> {
  if (env.apiMode === 'mock' || Platform.OS === 'web' || !Device.isDevice || !env.easProjectId) return null;
  if (!(await Notifications.getPermissionsAsync()).granted) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: env.easProjectId });
  return data;
}
