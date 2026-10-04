import type { Occurrence, Routine } from '../src';

export const TZ = 'America/Sao_Paulo';

export function routine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: 'r1',
    type: 'meal',
    name: 'Café da manhã',
    description: '',
    time: '08:00',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    medication: null,
    remindElder: true,
    alertIfMissed: false,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function occurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    routineId: 'r1',
    date: '2024-01-03',
    scheduledTime: '08:00',
    status: 'done',
    doneAt: null,
    doneBy: null,
    markedMissedAt: null,
    ...overrides,
  };
}
