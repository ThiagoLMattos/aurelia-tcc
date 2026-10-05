import type { PushData } from '@aurelia/shared';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import type { Logger } from 'pino';

export interface PushMessage {
  title: string;
  body: string;
  data: PushData;
  channelId: 'alerts' | 'reminders';
  priority: 'high' | 'default';
}

export interface PushResult {
  /** Tokens Expo reported as no longer registered; the caller should forget them. */
  invalidTokens: string[];
}

export interface PushSender {
  send(tokens: string[], message: PushMessage): Promise<PushResult>;
}

/** Used when nothing is configured (tests, local runs): sends nothing. */
export const noopPushSender: PushSender = { send: async () => ({ invalidTokens: [] }) };

/** Sends through Expo's push service in chunks. Receipts are not checked in v1. */
export function createExpoPushSender(logger: Logger): PushSender {
  const expo = new Expo();
  return {
    async send(tokens, message) {
      const valid = tokens.filter((token) => Expo.isExpoPushToken(token));
      const invalidTokens: string[] = tokens.filter((token) => !Expo.isExpoPushToken(token));
      const messages: ExpoPushMessage[] = valid.map((to) => ({
        to,
        title: message.title,
        body: message.body,
        data: message.data,
        channelId: message.channelId,
        priority: message.priority,
        sound: 'default',
      }));

      for (const chunk of expo.chunkPushNotifications(messages)) {
        try {
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          tickets.forEach((ticket, index) => {
            if (ticket.status !== 'error') return;
            if (ticket.details?.error === 'DeviceNotRegistered') invalidTokens.push(String(chunk[index]?.to));
            else logger.warn({ error: ticket.details?.error }, 'expo push ticket error');
          });
        } catch (error) {
          logger.warn({ err: error }, 'expo push chunk failed');
        }
      }
      return { invalidTokens };
    },
  };
}
