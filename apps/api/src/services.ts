import type { Logger } from 'pino';

import { systemClock, type Clock } from './clock';
import type { Firebase } from './firebase';
import { createAgendaService } from './modules/agenda/service';
import { createAuthService } from './modules/auth/service';
import { createContactsService } from './modules/contacts/service';
import { createEldersService } from './modules/elders/service';
import { createEventsService } from './modules/events/service';
import { createMissedTasksJob } from './modules/jobs/missedTasks';
import { createMeService } from './modules/me/service';
import { createPairingService } from './modules/pairing/service';
import { createReportsService } from './modules/reports/service';
import { createRoutinesService } from './modules/routines/service';
import { createSosService } from './modules/sos/service';
import { createRepos } from './repos';

interface ServiceDeps {
  firebase: Firebase;
  logger: Logger;
  now?: Clock;
}

/** Wires repos into services. Routes, tests and (later) the scheduler all build on this one graph. */
export function createServices({ firebase, logger, now = systemClock }: ServiceDeps) {
  const repos = createRepos(firebase.db);
  const events = createEventsService({ events: repos.events, now });

  return {
    repos,
    events,
    auth: createAuthService({ auth: firebase.auth, users: repos.users, logger }),
    me: createMeService(repos),
    elders: createEldersService({ elders: repos.elders, devices: repos.devices, now }),
    pairing: createPairingService({ auth: firebase.auth, elders: repos.elders, codes: repos.pairingCodes, now, logger }),
    routines: createRoutinesService({ routines: repos.routines, now }),
    agenda: createAgendaService({ routines: repos.routines, occurrences: repos.occurrences, events, now }),
    contacts: createContactsService({ contacts: repos.contacts, now }),
    reports: createReportsService({
      routines: repos.routines,
      occurrences: repos.occurrences,
      events: repos.events,
      now,
    }),
    sos: createSosService({ events }),
    missedTasks: createMissedTasksJob({
      elders: repos.elders,
      routines: repos.routines,
      occurrences: repos.occurrences,
      events,
      now,
      logger,
    }),
  };
}

export type Services = ReturnType<typeof createServices>;
