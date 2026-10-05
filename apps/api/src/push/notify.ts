import type { AlertType, LocalTime } from '@aurelia/shared';
import type { Logger } from 'pino';

import type { ElderDoc } from '../repos';
import type { EldersRepo } from '../repos/elders';
import type { UserDoc, UsersRepo } from '../repos/users';
import type { PushMessage, PushSender } from './sender';

interface Deps {
  sender: PushSender;
  users: UsersRepo;
  elders: EldersRepo;
  logger: Logger;
}

type Recipient = 'all' | 'notifyMissedTask' | 'notifyConfirmations';

const SEND_TIMEOUT_MS = 10_000;

const withTimeout = <T>(promise: Promise<T>): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('push timed out')), SEND_TIMEOUT_MS).unref()),
  ]);

/**
 * One function per event, each building the pt-BR text and the `data` the app routes on.
 * Delivery problems are logged and never thrown: a push must not fail the request or job behind it.
 */
export function createNotifier({ sender, users, elders, logger }: Deps) {
  async function deliver(
    elder: ElderDoc,
    recipient: Recipient,
    build: (elderId: string) => PushMessage,
  ): Promise<void> {
    try {
      const caregivers = (await users.getMany(elder.caregiverIds)).filter(
        (user) => recipient === 'all' || user.settings[recipient],
      );
      const tokens = [...new Set(caregivers.flatMap((user) => user.pushTokens))];
      if (tokens.length === 0) return;

      const { invalidTokens } = await withTimeout(sender.send(tokens, build(elder.id)));
      await forget(invalidTokens, caregivers, elder);
    } catch (error) {
      logger.warn({ err: error, elderId: elder.id }, 'push notification failed');
    }
  }

  async function forget(tokens: string[], caregivers: UserDoc[], elder: ElderDoc): Promise<void> {
    for (const token of tokens) {
      for (const user of caregivers) if (user.pushTokens.includes(token)) await users.removePushToken(user.id, token);
      if (elder.pushTokens.includes(token)) await elders.removePushToken(elder.id, token);
    }
  }

  return {
    sos: (elder: ElderDoc, eventId: string, at: { lat: number | null; lng: number | null }) =>
      deliver(elder, 'all', (elderId) => ({
        title: `SOS de ${elder.name}`,
        body: at.lat === null ? `${elder.name} pediu ajuda.` : `${elder.name} pediu ajuda. Toque para ver onde está.`,
        data: { type: 'sos', elderId, eventId },
        channelId: 'alerts',
        priority: 'high',
      })),

    geofenceExit: (elder: ElderDoc, eventId: string, distanceM: number) =>
      deliver(elder, 'all', (elderId) => ({
        title: `${elder.name} saiu da área segura`,
        body: `Está a cerca de ${Math.round(distanceM)} m do local seguro.`,
        data: { type: 'geofenceExit', elderId, eventId },
        channelId: 'alerts',
        priority: 'high',
      })),

    geofenceReturn: (elder: ElderDoc, eventId: string) =>
      deliver(elder, 'all', (elderId) => ({
        title: `${elder.name} voltou à área segura`,
        body: `${elder.name} está de volta ao local seguro.`,
        data: { type: 'geofenceReturn', elderId, eventId },
        channelId: 'alerts',
        priority: 'high',
      })),

    taskMissed: (elder: ElderDoc, eventId: string, routineName: string, time: LocalTime) =>
      deliver(elder, 'notifyMissedTask', (elderId) => ({
        title: 'Tarefa não confirmada',
        body: `${elder.name} não confirmou "${routineName}" (${time}).`,
        data: { type: 'taskMissed', elderId, eventId },
        channelId: 'reminders',
        priority: 'default',
      })),

    taskDone: (elder: ElderDoc, eventId: string, routineName: string) =>
      deliver(elder, 'notifyConfirmations', (elderId) => ({
        title: 'Tarefa confirmada',
        body: `${elder.name} confirmou "${routineName}".`,
        data: { type: 'taskDone', elderId, eventId },
        channelId: 'reminders',
        priority: 'default',
      })),

    deviceOffline: (elder: ElderDoc, eventId: string, label: string) =>
      deliver(elder, 'all', (elderId) => ({
        title: 'Rastreador sem sinal',
        body: `O rastreador "${label}" de ${elder.name} parou de enviar a localização.`,
        data: { type: 'deviceOffline', elderId, eventId },
        channelId: 'reminders',
        priority: 'default',
      })),

    /** Nobody acknowledged an alert in time, so the emergency contacts were texted (`sent` of them reached). */
    contactsAlerted: (elder: ElderDoc, eventId: string, alertType: AlertType, sent: number) =>
      deliver(elder, 'all', (elderId) => ({
        title: sent > 0 ? 'Contatos de emergência avisados' : 'Não foi possível avisar os contatos',
        body:
          sent > 0
            ? `Ninguém respondeu ao alerta de ${alertType === 'sos' ? 'SOS' : 'saída da área segura'} de ${elder.name}. ${sent === 1 ? '1 contato recebeu' : `${sent} contatos receberam`} um SMS.`
            : `O SMS para os contatos de emergência de ${elder.name} falhou. Ligue para eles.`,
        data: { type: 'contactsAlerted', elderId, eventId },
        channelId: 'alerts',
        priority: 'high',
      })),
  };
}

export type Notifier = ReturnType<typeof createNotifier>;
