import type { CreateRoutineBody, PatchRoutineBody, Routine, RoutinesResponse } from '@aurelia/shared';

import type { Clock } from '../../clock';
import { notFound, validationError } from '../../http/errors';
import type { RoutinesRepo } from '../../repos/routines';
import { toRoutine } from './serialize';

interface Deps {
  routines: RoutinesRepo;
  now: Clock;
}

const NOT_FOUND = 'Rotina não encontrada.';

export function createRoutinesService({ routines, now }: Deps) {
  return {
    async list(elderId: string): Promise<RoutinesResponse> {
      const docs = await routines.list(elderId);
      return { items: docs.map(toRoutine).sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name)) };
    },

    async create(elderId: string, body: CreateRoutineBody): Promise<Routine> {
      return toRoutine(await routines.create(elderId, body, now()));
    },

    async patch(elderId: string, routineId: string, patch: PatchRoutineBody): Promise<Routine> {
      const current = await routines.get(elderId, routineId);
      if (!current) throw notFound(NOT_FOUND);
      // A patch is validated on its own, so check the result still has a coherent medication.
      const type = patch.type ?? current.type;
      if (type === 'medication' && !(patch.medication ?? current.medication)) {
        throw validationError('Informe dose e forma do medicamento.', { issues: [{ path: 'medication', message: 'Obrigatório para medicamentos.' }] });
      }
      const updated = await routines.update(elderId, routineId, patch, now());
      if (!updated) throw notFound(NOT_FOUND);
      return toRoutine(updated);
    },

    /** Soft delete: the routine stays so history keeps its name. Idempotent. */
    async remove(elderId: string, routineId: string): Promise<void> {
      if (!(await routines.deactivate(elderId, routineId, now()))) throw notFound(NOT_FOUND);
    },
  };
}

export type RoutinesService = ReturnType<typeof createRoutinesService>;
