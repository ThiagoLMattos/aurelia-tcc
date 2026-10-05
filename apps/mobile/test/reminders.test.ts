import type { AgendaItem } from '@aurelia/shared';
import { describe, expect, it } from 'vitest';

import { diffReminders, planReminders } from '@/elder/reminders';

const TZ = 'America/Sao_Paulo';

function item(overrides: Partial<AgendaItem>): AgendaItem {
  return {
    routineId: 'r1',
    date: '2026-06-15',
    time: '08:00',
    type: 'medication',
    name: 'Losartana',
    description: '',
    medication: { dosage: '50 mg', form: 'comprimido' },
    status: 'upcoming',
    doneAt: null,
    doneBy: null,
    ...overrides,
  };
}

// 2026-06-15 07:00 in São Paulo (UTC-3).
const NOW = new Date('2026-06-15T10:00:00Z');

describe('planReminders', () => {
  it('plans open future items of routines that remind the elder, at their local time', () => {
    const plan = planReminders({ agendas: [[item({})]], remindRoutineIds: new Set(['r1']), now: NOW, timezone: TZ });
    expect(plan).toHaveLength(1);
    expect(plan[0]?.key).toBe('2026-06-15_r1');
    expect(plan[0]?.at.toISOString()).toBe('2026-06-15T11:00:00.000Z');
    expect(plan[0]?.title).toBe('Hora do remédio');
    expect(plan[0]?.body).toBe('Losartana — 50 mg');
  });

  it('skips done, missed, past and opted-out items', () => {
    const plan = planReminders({
      agendas: [[
        item({ routineId: 'done', status: 'done' }),
        item({ routineId: 'missed', status: 'missed' }),
        item({ routineId: 'past', time: '06:00', status: 'pending' }),
        item({ routineId: 'quiet' }),
      ]],
      remindRoutineIds: new Set(['done', 'missed', 'past']),
      now: NOW,
      timezone: TZ,
    });
    expect(plan).toEqual([]);
  });

  it('merges today and tomorrow in time order', () => {
    const plan = planReminders({
      agendas: [[item({ routineId: 'a', date: '2026-06-15', time: '12:00' })], [item({ routineId: 'b', date: '2026-06-16', time: '07:00' })]],
      remindRoutineIds: new Set(['a', 'b']),
      now: NOW,
      timezone: TZ,
    });
    expect(plan.map((r) => r.key)).toEqual(['2026-06-15_a', '2026-06-16_b']);
  });
});

describe('diffReminders', () => {
  const at = new Date('2026-06-15T11:00:00Z');
  const planned = [{ key: 'k1', at, title: 't', body: 'b' }];

  it('schedules what is missing and keeps what is in place', () => {
    expect(diffReminders(planned, {}).schedule).toHaveLength(1);
    const same = diffReminders(planned, { k1: { id: 'n1', at: at.getTime() } });
    expect(same.schedule).toEqual([]);
    expect(same.cancel).toEqual([]);
    expect(same.keep.k1?.id).toBe('n1');
  });

  it('cancels stale entries and reschedules ones whose time changed', () => {
    const diff = diffReminders(planned, { k1: { id: 'n1', at: at.getTime() + 60_000 }, gone: { id: 'n2', at: 1 } });
    expect(diff.cancel.sort()).toEqual(['n1', 'n2']);
    expect(diff.schedule).toHaveLength(1);
    expect(diff.keep).toEqual({});
  });
});
