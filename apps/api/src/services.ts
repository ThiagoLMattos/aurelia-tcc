import type { Logger } from 'pino';

import { systemClock, type Clock } from './clock';
import type { Firebase } from './firebase';
import { createNotifier } from './push/notify';
import { noopPushSender, type PushSender } from './push/sender';
import { createLogSmsSender, type SmsSender } from './sms/sender';
import { createAccountService } from './modules/account/service';
import { createAlertsService } from './modules/alerts/service';
import { createCaregiversService } from './modules/caregivers/service';
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
import { createEscalationJob } from './modules/jobs/escalation';
import { createDailySummaryJob } from './modules/jobs/dailySummary';
import { createConversationMemoryJob } from './modules/jobs/conversationMemory';
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
  /** Defaults to a sender that only logs; server.ts passes the one SMS_PROVIDER asks for. */
  sms?: SmsSender;
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
  sms = createLogSmsSender(logger),
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
  const escalation = createEscalationJob({
    elders: repos.elders,
    users: repos.users,
    contacts: repos.contacts,
    eventsRepo: repos.events,
    events,
    sms,
    notifier,
    now,
    logger,
  });

  const assistant = createAssistantService({
    llm,
    routines: repos.routines,
    occurrences: repos.occurrences,
    events: repos.events,
    memories: repos.memories,
    now,
    logger,
    ...(assistantTimeoutMs ? { timeoutMs: assistantTimeoutMs } : {}),
  });
  const conversationMemory = createConversationMemoryJob({ elders: repos.elders, memories: repos.memories, assistant, now, logger });
  const dailySummary = createDailySummaryJob({ elders: repos.elders, users: repos.users, assistant, events, notifier, now, logger });

  return {
    repos,
    events,
    notifier,
    auth: createAuthService({ auth: firebase.auth, users: repos.users, logger }),
    me: createMeService(repos),
    account: createAccountService({ firebase, logger }),
    elders: createEldersService({ elders: repos.elders, devices: repos.devices, now }),
    caregivers: createCaregiversService({ elders: repos.elders, users: repos.users, codes: repos.pairingCodes, now }),
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
    alerts: createAlertsService({ events: repos.events, users: repos.users, now }),
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
    assistant,
    jobs: createJobsService({
      elders: repos.elders,
      devices: repos.devices,
      events,
      missedTasks,
      escalation,
      dailySummary,
      conversationMemory,
      notifier,
      now,
      logger,
    }),
    missedTasks,
    escalation,
    dailySummary,
    conversationMemory,
  };
}

export type Services = ReturnType<typeof createServices>;
