import type { Firestore } from 'firebase-admin/firestore';

import { createContactsRepo, type ContactsRepo } from './contacts';
import { createDevicesRepo, type DevicesRepo } from './devices';
import { createEldersRepo, type EldersRepo } from './elders';
import { createEventsRepo, type EventsRepo } from './events';
import { createLocationRepo, type LocationRepo } from './location';
import { createMemoriesRepo, type MemoriesRepo } from './memories';
import { createOccurrencesRepo, type OccurrencesRepo } from './occurrences';
import { createPairingCodesRepo, type PairingCodesRepo } from './pairingCodes';
import { createRoutinesRepo, type RoutinesRepo } from './routines';
import { createUsersRepo, type UsersRepo } from './users';

export interface Repos {
  users: UsersRepo;
  elders: EldersRepo;
  routines: RoutinesRepo;
  occurrences: OccurrencesRepo;
  contacts: ContactsRepo;
  events: EventsRepo;
  devices: DevicesRepo;
  location: LocationRepo;
  pairingCodes: PairingCodesRepo;
  memories: MemoriesRepo;
}

export function createRepos(db: Firestore): Repos {
  const events = createEventsRepo(db);
  return {
    users: createUsersRepo(db),
    elders: createEldersRepo(db),
    routines: createRoutinesRepo(db),
    occurrences: createOccurrencesRepo(db, events),
    contacts: createContactsRepo(db),
    events,
    devices: createDevicesRepo(db, events),
    location: createLocationRepo(db, events),
    pairingCodes: createPairingCodesRepo(db),
    memories: createMemoriesRepo(db),
  };
}

export type { ContactDoc } from './contacts';
export type { ElderDoc } from './elders';
export type { EventDraft, EventRecord } from './events';
export type { OccurrenceDoc } from './occurrences';
export type { RoutineDoc } from './routines';
export type { UserDoc } from './users';
