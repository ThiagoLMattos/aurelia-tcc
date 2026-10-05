import type { Occurrence } from '@aurelia/shared';

import type { OccurrenceDoc } from '../../repos';

export const toOccurrence = (doc: OccurrenceDoc): Occurrence => ({
  routineId: doc.routineId,
  date: doc.date,
  scheduledTime: doc.scheduledTime,
  status: doc.status,
  doneAt: doc.doneAt?.toISOString() ?? null,
  doneBy: doc.doneBy,
  markedMissedAt: doc.markedMissedAt?.toISOString() ?? null,
});
