import AsyncStorage from '@react-native-async-storage/async-storage';

/** Keys the old elder screens kept on the phone (contacts and relations); the API owns them now. */
const LEGACY_KEYS = ['emergency_contacts'];
const LEGACY_PREFIX = 'relation_';

/** Deletes the pre-API contact data left on phones that ran the old app. Safe to run on every start. */
export async function clearLegacyElderStorage(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const stale = keys.filter((key) => LEGACY_KEYS.includes(key) || key.startsWith(LEGACY_PREFIX));
    if (stale.length > 0) await AsyncStorage.multiRemove(stale);
  } catch (error) {
    console.warn('[legacy] não foi possível limpar o armazenamento antigo', error);
  }
}
