import { startActivityAsync } from 'expo-intent-launcher';
import { Linking, PermissionsAndroid, Platform } from 'react-native';

import { dialable } from './phones';

/**
 * Calls the number straight away, so the elder does not have to find and press "Ligar" again in the
 * phone's dialer. That needs Android's CALL_PHONE permission, asked the first time a call is made.
 * Everywhere else it falls back to opening the dialer with the number filled in:
 * - iOS always asks for confirmation itself; apps cannot skip it.
 * - If the permission is refused, or the direct call fails.
 * - Short service numbers (SAMU 192, 190, 193…): Android does not let apps call emergency numbers
 *   directly, so these go to the dialer on purpose rather than risk a call that never starts.
 */
export async function callNow(phone: string): Promise<void> {
  const number = dialable(phone);
  const uri = `tel:${number}`;
  const serviceNumber = number.replace(/\D/g, '').length <= 4;
  if (Platform.OS === 'android' && !serviceNumber && (await canCallDirectly())) {
    // The promise only settles when the elder comes back to the app, so it is not awaited.
    startActivityAsync('android.intent.action.CALL', { data: uri }).catch(() => void Linking.openURL(uri));
    return;
  }
  await Linking.openURL(uri);
}

async function canCallDirectly(): Promise<boolean> {
  const permission = PermissionsAndroid.PERMISSIONS.CALL_PHONE;
  try {
    if (await PermissionsAndroid.check(permission)) return true;
    return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}
