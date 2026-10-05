import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { ensureNotificationPermission, ensureReminderChannel } from '@/push/registerPush';

import { diffReminders, type PlannedReminder, type ScheduledEntry } from './reminders';

/** The only app data kept in AsyncStorage besides Firebase Auth: reminder key → notification id. */
const MAP_KEY = 'aurelia.reminders';

async function readMap(): Promise<Record<string, ScheduledEntry>> {
  try {
    const raw = await AsyncStorage.getItem(MAP_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ScheduledEntry>) : {};
  } catch {
    return {};
  }
}

let running: Promise<void> = Promise.resolve();

/**
 * Makes the phone's scheduled local notifications match `planned` (channel `reminders`). Runs one at a
 * time, so two quick agenda refreshes cannot schedule the same reminder twice. Never throws.
 */
export function syncReminders(planned: readonly PlannedReminder[]): Promise<void> {
  running = running.then(() => apply(planned)).catch((error) => console.warn('[reminders] não foi possível agendar', error));
  return running;
}

async function apply(planned: readonly PlannedReminder[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const { cancel, schedule, keep } = diffReminders(planned, await readMap());
  await Promise.all(cancel.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));

  if (schedule.length > 0 && (await ensureNotificationPermission())) {
    await ensureReminderChannel();
    for (const reminder of schedule) {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: reminder.title, body: reminder.body, sound: 'default', data: { kind: 'reminder' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at, channelId: 'reminders' },
      });
      keep[reminder.key] = { id, at: reminder.at.getTime() };
    }
  }
  await AsyncStorage.setItem(MAP_KEY, JSON.stringify(keep));
}
