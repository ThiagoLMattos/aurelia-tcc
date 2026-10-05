import {
  LABELS_PT,
  addDays,
  computeAgenda,
  localDateOf,
  localTimeOf,
  weekdayOf,
  type AgendaItem,
  type Event,
  type LocalDate,
  type Occurrence,
  type Routine,
} from '@aurelia/shared';

import type { ElderDoc } from '../../repos';

export interface PromptContext {
  elder: Pick<ElderDoc, 'name' | 'birthDate' | 'diagnosisStage' | 'timezone' | 'missedTaskTimeoutMin'>;
  now: Date;
  routines: readonly Routine[];
  /** Occurrences of the last 7 days, today included (caregiver mode). */
  occurrences: readonly Occurrence[];
  /** Events of the last 7 days (caregiver mode). */
  events: readonly Event[];
}

const compact = (item: AgendaItem) => ({
  time: item.time,
  type: LABELS_PT.routineType[item.type],
  name: item.name,
  status: LABELS_PT.agendaStatus[item.status],
  ...(item.doneAt ? { doneAt: item.doneAt } : {}),
  ...(item.doneBy ? { doneBy: item.doneBy } : {}),
});

function ageOf(birthDate: string, today: LocalDate): number {
  const [by = 0, bm = 0, bd = 0] = birthDate.split('-').map(Number);
  const [ty = 0, tm = 0, td = 0] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

function agendaFor(ctx: PromptContext, date: LocalDate): AgendaItem[] {
  return computeAgenda({
    routines: ctx.routines,
    occurrences: ctx.occurrences,
    date,
    now: ctx.now,
    timezone: ctx.elder.timezone,
    missedTaskTimeoutMin: ctx.elder.missedTaskTimeoutMin,
  });
}

/** Only fields useful for answering questions; no phone numbers, emails or free-text notes. */
function summariseEvent(event: Event): Record<string, unknown> {
  const base = { type: event.type, at: event.at };
  switch (event.type) {
    case 'taskDone':
      return { ...base, task: event.payload.routineName, doneBy: event.payload.doneBy, undone: event.payload.undoneAt !== null };
    case 'taskMissed':
      return { ...base, task: event.payload.routineName, scheduledTime: event.payload.scheduledTime };
    case 'geofenceExit':
      return { ...base, distanceM: event.payload.distanceM, resolved: event.payload.resolvedAt !== null };
    case 'deviceOffline':
      return { ...base, lastSeenAt: event.payload.lastSeenAt };
    case 'gamePlayed':
      return { ...base, ...event.payload };
    default:
      return base;
  }
}

/** Spec §7. Caregiver mode is grounded in a compact JSON summary of the week; elder mode in today's agenda only. */
export function buildSystemPrompt(role: 'caregiver' | 'elder', ctx: PromptContext): string {
  const { elder, now } = ctx;
  const today = localDateOf(now, elder.timezone);
  const todayItems = agendaFor(ctx, today).map(compact);
  const profile = `${elder.name}, ${ageOf(elder.birthDate, today)} anos, estágio ${LABELS_PT.diagnosisStage[elder.diagnosisStage].toLowerCase()} da doença de Alzheimer.`;
  const clock = `Hoje é ${LABELS_PT.weekdayLong[weekdayOf(today)]}, ${today}, ${localTimeOf(now, elder.timezone)} (${elder.timezone}).`;

  if (role === 'elder') {
    const next = agendaFor(ctx, today).find((item) => item.status === 'upcoming' || item.status === 'now');
    return [
      `Você é a Aurélia, uma companhia gentil para ${elder.name}, uma pessoa idosa com Alzheimer.`,
      'Responda sempre em português do Brasil, com frases curtas, simples e carinhosas. Uma ideia por vez.',
      'Nunca dê conselhos médicos além do que está na rotina cadastrada. Não invente horários nem remédios.',
      'Se a pessoa disser que está com dor, perdida, com medo, passando mal ou precisando de ajuda, acalme-a e diga para apertar o botão SOS.',
      '',
      clock,
      `Sobre ela: ${elder.name}.`,
      `Rotina de hoje (JSON): ${JSON.stringify(todayItems)}`,
      next ? `Próximo item: ${next.name} às ${next.time}.` : 'Não há mais itens pendentes hoje.',
    ].join('\n');
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const summary = {
    elder: profile,
    now: `${today} ${localTimeOf(now, elder.timezone)}`,
    timezone: elder.timezone,
    today: todayItems,
    last7Days: days.map((date) => {
      const items = agendaFor(ctx, date);
      const count = (status: AgendaItem['status']) => items.filter((item) => item.status === status).length;
      return { date, done: count('done'), missed: count('missed'), pending: count('pending'), items: items.map(compact) };
    }),
    events: ctx.events.map(summariseEvent),
  };
  return [
    `Você é a Aurélia, assistente de apoio para quem cuida de ${elder.name}, uma pessoa idosa com Alzheimer.`,
    'Responda em português do Brasil, de forma clara e objetiva, usando somente os dados abaixo. Se a resposta não estiver nos dados, diga que não sabe.',
    'Não faça diagnósticos nem altere doses; para dúvidas médicas, recomende falar com o médico responsável.',
    `Resumo (JSON): ${JSON.stringify(summary)}`,
  ].join('\n');
}
