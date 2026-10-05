import type { Logger } from 'pino';

import { systemClock, type Clock } from './clock';
import type { Firebase } from './firebase';
import { createNotifier } from './push/notify';
import { noopPushSender, type PushSender } from './push/sender';
import { createAssistantService } from './modules/assistant/service';
import { createAgendaService } from './modules/agenda/service';
import { createAuthService } from './modules/auth/service';
import { createContactsService } from './modules/contacts/service';
import { createDevicesService } from './modules/devices/service';
import { createEldersService } from './modules/elders/service';
import { createEventsService } from './modules/events/service';
import { createGamesService } from './modules/games/service';
import { createJobsService } from './modules/jobs/service';
import { createLocationService } from './modules/location/service';
import { createMissedTasksJob } from './modules/jobs/missedTasks';
import { createMeService } from './modules/me/service';
import { createPairingService } from './modules/pairing/service';
import { createReportsService } from './modules/reports/service';
import { createRoutinesService } from './modules/routines/service';
import { createSosService } from './modules/sos/service';
import { createRepos } from './repos';
import { createFakeProvider, type LlmProvider } from './modules/assistant/provider';

interface ServiceDeps {
  firebase: Firebase;
  logger: Logger;
  now?: Clock;
  /** Defaults to a sender that sends nothing; server.ts passes the real one. */
  push?: PushSender;
  /** Defaults to the fake provider; server.ts / createApp pass the configured one. */
  llm?: LlmProvider;
  assistantTimeoutMs?: number;
}

/** Wires repos into services. Routes, tests and (later) the scheduler all build on this one graph. */
export function createServices({
  firebase,
  logger,
  now = systemClock,
  push = noopPushSender,
  llm = createFakeProvider(),
  assistantTimeoutMs,
}: ServiceDeps) {
  const repos = createRepos(firebase.db);
  const events = createEventsService({ events: repos.events, now });
  const notifier = createNotifier({ sender: push, users: repos.users, elders: repos.elders, logger });
  const missedTasks = createMissedTasksJob({
    elders: repos.elders,
    routines: repos.routines,
    occurrences: repos.occurrences,
    events,
    notifier,
    now,
    logger,
  });
  const devices = createDevicesService({ devices: repos.devices, events, now });

  return {
    repos,
    events,
    notifier,
    auth: createAuthService({ auth: firebase.auth, users: repos.users, logger }),
    me: createMeService(repos),
    elders: createEldersService({ elders: repos.elders, devices: repos.devices, now }),
    pairing: createPairingService({ auth: firebase.auth, elders: repos.elders, codes: repos.pairingCodes, now, logger }),
    routines: createRoutinesService({ routines: repos.routines, now }),
    agenda: createAgendaService({ routines: repos.routines, occurrences: repos.occurrences, events, notifier, now }),
    contacts: createContactsService({ contacts: repos.contacts, now }),
    reports: createReportsService({
      routines: repos.routines,
      occurrences: repos.occurrences,
      events: repos.events,
      now,
    }),
    sos: createSosService({ events, notifier }),
    games: createGamesService({ events }),
    devices,
    location: createLocationService({
      location: repos.location,
      devices: repos.devices,
      eventsRepo: repos.events,
      events,
      notifier,
      now,
    }),
    assistant: createAssistantService({
      llm,
      routines: repos.routines,
      occurrences: repos.occurrences,
      events: repos.events,
      now,
      logger,
      ...(assistantTimeoutMs ? { timeoutMs: assistantTimeoutMs } : {}),
    }),
    jobs: createJobsService({ elders: repos.elders, devices: repos.devices, events, missedTasks, notifier, now, logger }),
    missedTasks,
  };
}

export type Services = ReturnType<typeof createServices>;
