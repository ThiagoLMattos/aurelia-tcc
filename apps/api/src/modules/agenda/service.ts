import {
  addDays,
  computeAgenda,
  localDateOf,
  weekdayOf,
  type AgendaItem,
  type AgendaQuery,
  type AgendaResponse,
  type LocalDate,
} from '@aurelia/shared';

import type { Clock } from '../../clock';
import { conflict, forbidden, notFound } from '../../http/errors';
import type { ElderDoc } from '../../repos';
import type { OccurrencesRepo } from '../../repos/occurrences';
import type { RoutinesRepo } from '../../repos/routines';
import type { Notifier } from '../../push/notify';
import type { EventsService } from '../events/service';
import { toRoutine } from '../routines/serialize';
import { toOccurrence } from './serialize';

interface Deps {
  routines: RoutinesRepo;
  occurrences: OccurrencesRepo;
  events: EventsService;
  notifier: Notifier;
  now: Clock;
}

/** How many days back a caregiver may still confirm a task. */
const CAREGIVER_BACKFILL_DAYS = 2;

export function createAgendaService({ routines, occurrences, events, notifier, now }: Deps) {
  /** Spec §5: the elder confirms only today; a caregiver today and the previous two days. */
  function assertCanMarkDone(role: Express.AuthContext['role'], date: LocalDate, today: LocalDate): void {
    if (date > today) throw forbidden('Não é possível confirmar tarefas de dias futuros.');
    if (role === 'elder' && date !== today) throw forbidden('Você só pode confirmar tarefas de hoje.');
    if (role === 'caregiver' && date < addDays(today, -CAREGIVER_BACKFILL_DAYS)) {
      throw forbidden('Só é possível confirmar tarefas dos últimos 3 dias.');
    }
  }

  return {
    async get(elder: ElderDoc, query: AgendaQuery): Promise<AgendaResponse> {
      const current = now();
      const date = query.date ?? localDateOf(current, elder.timezone);
      const [routineDocs, occurrenceDocs] = await Promise.all([
        routines.list(elder.id),
        occurrences.forDate(elder.id, date),
      ]);
      return {
        date,
        items: computeAgenda({
          routines: routineDocs.map(toRoutine),
          occurrences: occurrenceDocs.map(toOccurrence),
          date,
          now: current,
          timezone: elder.timezone,
          missedTaskTimeoutMin: elder.missedTaskTimeoutMin,
        }),
      };
    },

    /** Records the confirmation and its taskDone event together; a second confirmation is a 409. */
    async markDone(
      elder: ElderDoc,
      auth: Express.AuthContext,
      date: LocalDate,
      routineId: string,
    ): Promise<AgendaItem> {
      const current = now();
      assertCanMarkDone(auth.role, date, localDateOf(current, elder.timezone));

      const routine = await routines.get(elder.id, routineId);
      if (!routine?.active || !routine.weekdays.includes(weekdayOf(date))) {
        throw notFound('Tarefa não encontrada nesta data.');
      }

      const doneBy = auth.role;
      const eventId = await occurrences.createDone(
        elder.id,
        { routineId, date, scheduledTime: routine.time, doneAt: current, doneBy },
        events.record(
          elder,
          {
            type: 'taskDone',
            payload: { routineId, routineName: routine.name, date, scheduledTime: routine.time, doneBy, undoneAt: null },
          },
          current,
        ),
      );
      if (eventId === null) throw conflict('Esta tarefa já foi registrada.');
      // Caregivers already know about their own confirmations; only the elder's are news.
      if (doneBy === 'elder') await notifier.taskDone(elder, eventId, routine.name);

      const [item] = computeAgenda({
        routines: [toRoutine(routine)],
        occurrences: [
          {
            routineId,
            date,
            scheduledTime: routine.time,
            status: 'done',
            doneAt: current.toISOString(),
            doneBy,
            markedMissedAt: null,
          },
        ],
        date,
        now: current,
        timezone: elder.timezone,
        missedTaskTimeoutMin: elder.missedTaskTimeoutMin,
      });
      return item as AgendaItem;
    },

    /** Removes the confirmation. The original event stays, flagged with `undoneAt`; nothing new is appended. */
    async undoDone(elder: ElderDoc, date: LocalDate, routineId: string): Promise<void> {
      const result = await occurrences.undoDone(elder.id, date, routineId, now());
      if (result === 'notFound') throw notFound('Esta tarefa não está marcada como feita.');
      if (result === 'notDone') throw conflict('Esta tarefa foi registrada como perdida, não como feita.');
    },
  };
}

export type AgendaService = ReturnType<typeof createAgendaService>;
