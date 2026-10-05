import { instantOf, type AgendaItem, type LocalDate } from '@aurelia/shared';

/** A local notification the elder's phone should have scheduled. `key` is `{date}_{routineId}`. */
export interface PlannedReminder {
  key: string;
  at: Date;
  title: string;
  body: string;
}

const TYPE_VERB: Record<AgendaItem['type'], string> = {
  medication: 'Hora do remédio',
  meal: 'Hora de comer',
  activity: 'Hora da atividade',
  custom: 'Hora da tarefa',
};

/**
 * Which reminders should exist right now: items of the given agendas that are still open, whose routine
 * asked to remind the elder, and whose time has not passed yet. Pure, so the schedule can be tested.
 */
export function planReminders(input: {
  agendas: readonly (readonly AgendaItem[])[];
  remindRoutineIds: ReadonlySet<string>;
  now: Date;
  timezone: string;
}): PlannedReminder[] {
  const { agendas, remindRoutineIds, now, timezone } = input;
  const planned: PlannedReminder[] = [];
  for (const items of agendas) {
    for (const item of items) {
      if (item.status === 'done' || item.status === 'missed') continue;
      if (!remindRoutineIds.has(item.routineId)) continue;
      const at = instantOf(item.date as LocalDate, item.time, timezone);
      if (at.getTime() <= now.getTime()) continue;
      planned.push({
        key: `${item.date}_${item.routineId}`,
        at,
        title: TYPE_VERB[item.type],
        body: item.medication ? `${item.name} — ${item.medication.dosage}` : item.name,
      });
    }
  }
  return planned.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** What is already scheduled for a key: the OS notification id and when it fires. */
export interface ScheduledEntry {
  id: string;
  at: number;
}

export interface ReminderDiff {
  cancel: string[];
  schedule: PlannedReminder[];
  keep: Record<string, ScheduledEntry>;
}

/**
 * Compares the plan with what is scheduled. Entries that are no longer wanted (task done, routine
 * edited or deleted) or that fire at a different time are cancelled; missing ones are scheduled.
 */
export function diffReminders(planned: readonly PlannedReminder[], existing: Readonly<Record<string, ScheduledEntry>>): ReminderDiff {
  const wanted = new Map(planned.map((r) => [r.key, r]));
  const cancel: string[] = [];
  const keep: Record<string, ScheduledEntry> = {};
  for (const [key, entry] of Object.entries(existing)) {
    const target = wanted.get(key);
    if (target && target.at.getTime() === entry.at) keep[key] = entry;
    else cancel.push(entry.id);
  }
  return { cancel, schedule: planned.filter((r) => !(r.key in keep)), keep };
}
