import type { Routine } from '@aurelia/shared';

import type { RoutineDoc } from '../../repos';

export function toRoutine(doc: RoutineDoc): Routine {
  return {
    id: doc.id,
    type: doc.type,
    name: doc.name,
    description: doc.description,
    time: doc.time,
    weekdays: doc.weekdays,
    medication: doc.medication,
    remindElder: doc.remindElder,
    alertIfMissed: doc.alertIfMissed,
    active: doc.active,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
