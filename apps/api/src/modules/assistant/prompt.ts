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
import type { MemoryDoc } from '../../repos/memories';

export interface PromptContext {
  elder: Pick<ElderDoc, 'name' | 'birthDate' | 'diagnosisStage' | 'timezone' | 'missedTaskTimeoutMin' | 'about'>;
  now: Date;
  routines: readonly Routine[];
  /** Occurrences of the last 7 days, today included (caregiver mode). */
  occurrences: readonly Occurrence[];
  /** Events of the last 7 days (caregiver mode). */
  events: readonly Event[];
  /** Summaries of earlier conversations between the elder and Aurélia, newest first. */
  memories: readonly Pick<MemoryDoc, 'date' | 'summary'>[];
}

const brDate = (date: LocalDate) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/** "Sobre …" and the earlier conversations, as plain lines; empty parts are left out. */
function personalLines(ctx: PromptContext): string[] {
  const { elder } = ctx;
  return [
    ...(elder.about.trim() ? [`Sobre ${elder.name}, escrito pela família: ${elder.about.trim()}`] : []),
    ...(ctx.memories.length > 0
      ? [
          `Conversas anteriores de ${elder.name} com a Aurélia (resumos do que a pessoa contou, da mais recente para a mais antiga). ` +
            'Podem conter confusões da doença: quando discordarem do que a família escreveu, vale o que a família escreveu.',
          ...ctx.memories.map((memory) => `- ${brDate(memory.date)}: ${memory.summary}`),
        ]
      : []),
  ];
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
    case 'sos':
      return { ...base, answered: event.payload.acknowledgedAt !== null, contactsTexted: event.payload.escalatedAt !== null };
    case 'geofenceExit':
      return {
        ...base,
        distanceM: event.payload.distanceM,
        resolved: event.payload.resolvedAt !== null,
        contactsTexted: event.payload.escalatedAt !== null,
      };
    case 'contactsAlerted':
      return { ...base, alertType: event.payload.alertType, contactsReached: event.payload.sent.length, contactsFailed: event.payload.failed.length };
    case 'deviceOffline':
      return { ...base, lastSeenAt: event.payload.lastSeenAt };
    case 'gamePlayed':
      return { ...base, ...event.payload };
    default:
      return base;
  }
}

/** Whether the day has anything to summarise: a routine due today, or something on today's timeline. */
export function hasSomethingToday(ctx: PromptContext): boolean {
  const today = localDateOf(ctx.now, ctx.elder.timezone);
  return (
    agendaFor(ctx, today).length > 0 ||
    ctx.events.some((event) => event.date === today && event.type !== 'dailySummary') ||
    ctx.memories.some((memory) => memory.date === today)
  );
}

/** The request behind "Insights da Aurélia": one short paragraph, plain text, read on a lock screen. */
export function dailySummaryRequest(elderName: string): string {
  return [
    `Escreva para os cuidadores o resumo do dia de hoje de ${elderName}, em no máximo 3 frases curtas:`,
    'o que foi feito, o que ficou para trás, qualquer alerta (SOS, saída da área segura, rastreador sem sinal)',
    'e, se conversou com a Aurélia hoje, como estava se sentindo.',
    'Se fizer sentido, termine com uma sugestão prática para amanhã. Sem títulos, listas, emojis ou markdown.',
  ].join(' ');
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
      `Você é a Aurélia, a companhia de ${elder.name}, uma pessoa idosa com Alzheimer. Seu papel é fazer companhia, ajudar a lembrar das coisas do dia e da própria vida, para que ${elder.name} nunca se sinta só.`,
      'Fale sempre em português do Brasil, com frases curtas, simples e carinhosas. Uma ideia por vez. Chame pelo nome.',
      'Converse de verdade: mostre interesse e faça uma pergunta gentil por vez sobre a família, as lembranças, os gostos e o dia. Use o que você sabe (abaixo) para puxar assunto e para lembrar junto, sem testar a memória.',
      'Se a pessoa repetir uma pergunta ou uma história, responda com a mesma paciência, como se fosse a primeira vez. Nunca diga que ela já perguntou.',
      'Nunca corrija nem discuta quando ela confundir datas, pessoas ou lugares: acolha o sentimento e mude de assunto com delicadeza.',
      'Mas também não confirme como verdade o que a família não confirmou (por exemplo, a visita de alguém que já faleceu): fale do carinho e das lembranças, não do fato.',
      'Lembre das tarefas do dia quando fizer sentido, sem cobrar.',
      'Nunca dê conselhos médicos além do que está na rotina cadastrada. Não invente horários, remédios nem fatos sobre a vida da pessoa.',
      'Se a pessoa disser que está com dor, perdida, com medo, passando mal ou precisando de ajuda, acalme-a e diga para apertar o botão SOS.',
      'Se parecer triste ou sozinha, acolha e sugira ligar para alguém querido pelo botão Telefone.',
      '',
      clock,
      ...personalLines(ctx),
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
    ...personalLines(ctx),
    `Resumo (JSON): ${JSON.stringify(summary)}`,
  ].join('\n');
}

/** Turns a finished conversation into a transcript the summary request can read. */
export function conversationTranscript(elderName: string, turns: readonly { role: 'user' | 'assistant'; content: string }[]): string {
  return turns.map((turn) => `${turn.role === 'user' ? elderName : 'Aurélia'}: ${turn.content}`).join('\n');
}

/** The answer the summary request gives when a conversation had nothing worth remembering. */
export const NOTHING_TO_REMEMBER = 'NADA';

/** Instructions for summarising one conversation into Aurélia's memory. */
export function memorySystemPrompt(elder: Pick<ElderDoc, 'name'>): string {
  return [
    `Você ajuda a Aurélia, companhia de ${elder.name} (uma pessoa idosa com Alzheimer), a lembrar das conversas que tiveram.`,
    `Leia a conversa e escreva, em até 3 frases curtas e em terceira pessoa, o que vale lembrar da próxima vez: pessoas e lugares que ${elder.name} mencionou, lembranças que contou, gostos, preocupações, planos e como estava se sentindo.`,
    'Use só o que a própria pessoa disse; não repita o que a Aurélia falou e não invente nada. Sem títulos, listas ou markdown.',
    'Escreva como relato ("contou que", "disse que", "lembrou de"), nunca como fato confirmado: com Alzheimer, a pessoa pode confundir pessoas, datas e acontecimentos.',
    `Se não houver nada que valha lembrar (só cumprimentos ou perguntas sobre horários), responda exatamente: ${NOTHING_TO_REMEMBER}`,
  ].join('\n');
}
