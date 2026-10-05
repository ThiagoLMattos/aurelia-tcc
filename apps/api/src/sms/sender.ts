import type { Logger } from 'pino';

import type { Config } from '../config';

export interface SmsSender {
  /** Sends one text to an E.164 number. Throws when the provider refused it. */
  send(to: string, body: string): Promise<void>;
}

/** Used when no provider is configured (tests, local runs, demos): writes the text to the log instead. */
export function createLogSmsSender(logger: Logger): SmsSender {
  return {
    async send(to, body) {
      logger.info({ to: `…${to.slice(-4)}`, body }, 'SMS not sent (SMS_PROVIDER=log)');
    },
  };
}

export interface TwilioOptions {
  accountSid: string;
  authToken: string;
  /** A Twilio number (E.164) or a Messaging Service SID (`MG…`). */
  from: string;
  fetch?: typeof fetch;
}

const SEND_TIMEOUT_MS = 10_000;

/** Twilio's Messages API over plain HTTPS; one request per text. */
export function createTwilioSmsSender({ accountSid, authToken, from, fetch: doFetch = fetch }: TwilioOptions): SmsSender {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const authorization = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
  const sender = from.startsWith('MG') ? { MessagingServiceSid: from } : { From: from };

  return {
    async send(to, body) {
      const response = await doFetch(url, {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: to, Body: body, ...sender }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (response.ok) return;
      const detail = (await response.json().catch(() => null)) as { code?: number; message?: string } | null;
      throw new Error(`Twilio refused the SMS (${response.status}${detail?.code ? `, code ${detail.code}` : ''}): ${detail?.message ?? 'no detail'}`);
    },
  };
}

/** The sender `SMS_PROVIDER` asks for; loadConfig has already checked the Twilio keys are there. */
export function createSmsSender(config: Pick<Config, 'SMS_PROVIDER' | 'TWILIO_ACCOUNT_SID' | 'TWILIO_AUTH_TOKEN' | 'TWILIO_FROM'>, logger: Logger): SmsSender {
  if (config.SMS_PROVIDER === 'log') return createLogSmsSender(logger);
  return createTwilioSmsSender({
    accountSid: config.TWILIO_ACCOUNT_SID as string,
    authToken: config.TWILIO_AUTH_TOKEN as string,
    from: config.TWILIO_FROM as string,
  });
}
