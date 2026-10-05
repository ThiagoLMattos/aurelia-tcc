import { addDays, type Elder } from '@aurelia/shared';
import { useEffect } from 'react';

import { useAgenda, useRoutines, useToday } from '@/queries';

import { planReminders } from './reminders';
import { syncReminders } from './reminderSync';

/**
 * Keeps the phone's local reminders in step with the agenda: whenever today's or tomorrow's agenda (or
 * the routines) change, the open reminders of routines with "avisar o idoso" are rescheduled.
 */
export function useElderReminders(elder: Elder): void {
  const today = useToday(elder);
  const routines = useRoutines(elder.id);
  const todayAgenda = useAgenda(elder.id, today);
  const tomorrowAgenda = useAgenda(elder.id, addDays(today, 1));

  const routineItems = routines.data?.items;
  const todayItems = todayAgenda.data?.items;
  const tomorrowItems = tomorrowAgenda.data?.items;

  useEffect(() => {
    if (!routineItems || !todayItems || !tomorrowItems) return;
    const remindRoutineIds = new Set(routineItems.filter((r) => r.active && r.remindElder).map((r) => r.id));
    const plan = planReminders({ agendas: [todayItems, tomorrowItems], remindRoutineIds, now: new Date(), timezone: elder.timezone });
    void syncReminders(plan);
  }, [routineItems, todayItems, tomorrowItems, elder.timezone]);
}
