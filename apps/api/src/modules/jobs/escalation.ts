import { ESCALATE_AFTER_MIN, ESCALATION_WINDOW_MIN, localTimeOf, type AlertEvent, type Event } from '@aurelia/shared';
import type { Logger } from 'pino';

import type { Clock } from '../../clock';
import type { Notifier } from '../../push/notify';
import type { ElderDoc } from '../../repos';
import type { ContactDoc, ContactsRepo } from '../../repos/contacts';
import type { EldersRepo } from '../../repos/elders';
import type { EventsRepo } from '../../repos/events';
import type { UsersRepo } from '../../repos/users';
import type { SmsSender } from '../../sms/sender';
import type { EventsService } from '../events/service';

interface Deps {
  elders: EldersRepo;
  users: UsersRepo;
  contacts: ContactsRepo;
  eventsRepo: EventsRepo;
  events: EventsService;
  sms: SmsSender;
  notifier: Notifier;
  now: Clock;
  logger: Logger;
}

type Alert = AlertEvent;

const MINUTE_MS = 60_000;

const isPending = (event: Event): event is Alert =>
  (event.type === 'sos' || event.type === 'geofenceExit') &&
  !event.payload.acknowledgedAt &&
  !event.payload.escalatedAt &&
  !(event.type === 'geofenceExit' && event.payload.resolvedAt);

const mapLink = (lat: number, lng: number) => `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;

/** The text each emergency contact gets; kept short, it is billed per segment. */
export function escalationSms(elder: ElderDoc, alert: Alert): string {
  const time = localTimeOf(new Date(alert.at), elder.timezone);
  const what = alert.type === 'sos' ? `pediu ajuda (SOS) às ${time}` : `saiu da área segura às ${time}`;
  const { lastLat, lastLng } = elder.locationState;
  const position =
    alert.type === 'geofenceExit' && lastLat !== null && lastLng !== null
      ? { lat: lastLat, lng: lastLng }
      : alert.payload.lat !== null && alert.payload.lng !== null
        ? { lat: alert.payload.lat, lng: alert.payload.lng }
        : null;
  return [
    `Aurélia: ${elder.name} ${what} e o cuidador ainda não respondeu.`,
    'Você é contato de emergência: por favor, entre em contato.',
    ...(position ? [`Local: ${mapLink(position.lat, position.lng)}`] : []),
  ].join(' ');
}

/**
 * "Me, then the contacts" (spec §6): an SOS or safe-zone exit nobody acknowledged within
 * ESCALATE_AFTER_MIN minutes is texted to the elder's emergency contacts, once. It applies when at
 * least one of the elder's caregivers chose it. A safe-zone exit only escalates while the elder is
 * still outside and it is the latest exit.
 */
export function createEscalationJob({ elders, users, contacts, eventsRepo, events, sms, notifier, now, logger }: Deps) {
  async function textContacts(elder: ElderDoc, alert: Alert, to: ContactDoc[], at: Date): Promise<void> {
    const body = escalationSms(elder, alert);
    const results = await Promise.allSettled(to.map((contact) => sms.send(contact.phone, body)));
    const sent: string[] = [];
    const failed: string[] = [];
    results.forEach((result, index) => {
      const name = (to[index] as ContactDoc).name;
      if (result.status === 'fulfilled') sent.push(name);
      else {
        failed.push(name);
        logger.warn({ err: result.reason, elderId: elder.id, alertId: alert.id }, 'escalation SMS failed');
      }
    });

    const recorded = await events.append(
      elder,
      { type: 'contactsAlerted', payload: { alertEventId: alert.id, alertType: alert.type, sent, failed } },
      at,
    );
    await notifier.contactsAlerted(elder, recorded.id, alert.type, sent.length);
  }

  async function runForElder(elder: ElderDoc, at: Date): Promise<number> {
    const window = await eventsRepo.query(elder.id, {
      types: ['sos', 'geofenceExit'],
      from: new Date(at.getTime() - ESCALATION_WINDOW_MIN * MINUTE_MS),
      to: new Date(at.getTime() - ESCALATE_AFTER_MIN * MINUTE_MS + 1),
      limit: 20,
    });
    let due = (window?.items ?? []).filter(isPending);
    if (due.some((alert) => alert.type === 'geofenceExit')) {
      const latestExit = (await eventsRepo.query(elder.id, { types: ['geofenceExit'], limit: 1 }))?.items[0];
      const outside = elder.locationState.status === 'outside';
      due = due.filter((alert) => alert.type === 'sos' || (outside && alert.id === latestExit?.id));
    }
    if (due.length === 0) return 0;

    const caregivers = await users.getMany(elder.caregiverIds);
    if (!caregivers.some((caregiver) => caregiver.settings.escalation === 'meThenContacts')) return 0;
    const emergency = (await contacts.list(elder.id)).filter((contact) => contact.isEmergency);
    if (emergency.length === 0) return 0;

    let escalated = 0;
    for (const alert of due) {
      const claimed = await eventsRepo.claimEscalation(elder.id, alert.id, at);
      if (!claimed || !isPending(claimed)) continue;
      await textContacts(elder, claimed, emergency, at);
      escalated += 1;
    }
    return escalated;
  }

  return {
    /** Returns how many alerts were texted to contacts. One elder failing never stops the others. */
    async run(at: Date = now()): Promise<number> {
      let escalated = 0;
      for (const elder of await elders.listAll()) {
        try {
          escalated += await runForElder(elder, at);
        } catch (error) {
          logger.error({ err: error, elderId: elder.id }, 'escalation check failed for elder');
        }
      }
      return escalated;
    },
  };
}

export type EscalationJob = ReturnType<typeof createEscalationJob>;
