import type { DiagnosisStage } from './elder';
import type { Escalation } from './me';
import type { AgendaStatus } from './agenda';
import type { RoutineType } from './routine';

/** Portuguese user-facing labels, shared so both apps show the same words. */
export const LABELS_PT = {
  routineType: {
    medication: 'Medicamento',
    meal: 'Refeição',
    activity: 'Atividade',
    custom: 'Outro',
  } satisfies Record<RoutineType, string>,
  diagnosisStage: {
    early: 'Inicial',
    moderate: 'Moderado',
    advanced: 'Avançado',
  } satisfies Record<DiagnosisStage, string>,
  agendaStatus: {
    upcoming: 'Em breve',
    now: 'Agora',
    pending: 'Pendente',
    done: 'Concluído',
    missed: 'Perdido',
  } satisfies Record<AgendaStatus, string>,
  escalation: {
    meOnly: 'Somente eu',
    meThenContacts: 'Eu e depois os contatos',
  } satisfies Record<Escalation, string>,
  weekdayShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  weekdayLong: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
} as const;
