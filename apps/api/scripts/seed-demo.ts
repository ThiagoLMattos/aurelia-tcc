/**
 * Seeds the demonstration data for the project defence: one caregiver, one elder with a week of
 * routines, confirmations, missed tasks, a geofence exit and an SOS, two contacts and one tracker.
 *
 *   npm run seed:demo -- --project demo-aurelia --emulators     (local emulators)
 *   npm run seed:demo -- --project <firebase-project> --yes     (a real project, with credentials)
 *
 * It drives the same services the API uses, with a clock it moves by hand, so every document has the
 * shape the app expects. Running it again wipes the demo account (and only that account) first.
 */
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { addDays, instantOf, localDateOf, weekdayOf, type CreateRoutineBody, type GamePlayedPayload } from '@aurelia/shared';
import type { Logger } from 'pino';

import type { Clock } from '../src/clock';
import { loadConfig } from '../src/config';
import { initFirebase, type Firebase } from '../src/firebase';
import { createLogger } from '../src/logger';
import { createMissedTasksJob } from '../src/modules/jobs/missedTasks';
import { elderUid } from '../src/modules/pairing/service';
import { createServices } from '../src/services';

export const DEMO_EMAIL = 'demo.cuidador@aurelia.test';
export const DEMO_ELDER_NAME = 'Maria Aparecida';

const TIMEZONE = 'America/Sao_Paulo';
const HOME = { lat: -22.9056, lng: -47.0608, radiusM: 100 };
const DAYS_OF_HISTORY = 7;
const MINUTE_MS = 60_000;

type RoutineSeed = Pick<CreateRoutineBody, 'type' | 'name' | 'description' | 'time' | 'weekdays'> &
  Partial<Pick<CreateRoutineBody, 'medication' | 'alertIfMissed'>>;

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const ROUTINES: RoutineSeed[] = [
  { type: 'medication', name: 'Omeprazol', description: 'Tomar em jejum', time: '07:00', weekdays: EVERY_DAY, medication: { dosage: '20 mg', form: 'cápsula' }, alertIfMissed: true },
  { type: 'activity', name: 'Caminhada', description: 'Caminhar 20 minutos no parque', time: '08:30', weekdays: [1, 2, 3, 4, 5, 6] },
  { type: 'meal', name: 'Café da manhã', description: 'Café com pão e fruta', time: '09:00', weekdays: EVERY_DAY },
  { type: 'medication', name: 'Losartana', description: 'Tomar com água', time: '12:00', weekdays: EVERY_DAY, medication: { dosage: '50 mg', form: 'comprimido' }, alertIfMissed: true },
  { type: 'meal', name: 'Almoço', description: 'Almoçar com a família', time: '12:30', weekdays: EVERY_DAY },
  { type: 'activity', name: 'Repouso', description: 'Descansar por 30 minutos', time: '14:00', weekdays: EVERY_DAY },
  { type: 'medication', name: 'Metformina', description: 'Tomar após o jantar', time: '19:00', weekdays: EVERY_DAY, medication: { dosage: '850 mg', form: 'comprimido' }, alertIfMissed: true },
];

/** `${days ago}:${routine}` pairs the elder never confirms; medications among them raise a missed-task event. */
const NOT_DONE = new Set(['5:Losartana', '3:Metformina', '2:Caminhada', '1:Omeprazol']);
/** Minutes after the scheduled time at which the elder tends to confirm, cycling through the list. */
const CONFIRM_DELAYS_MIN = [2, 5, 9, 4, 12, 7, 3];

export interface SeedOptions {
  firebase: Firebase;
  logger: Logger;
  /** Defaults to a random one; printed at the end. */
  password?: string;
  /** The real current time. Tests pass a fixed one. */
  now?: Clock;
}

export interface SeedResult {
  email: string;
  password: string;
  caregiverId: string;
  elderId: string;
  elderName: string;
  pairingCode: string;
  pairingCodeExpiresAt: string;
  deviceId: string;
  deviceSecret: string;
  counts: { routines: number; events: number; occurrences: number; contacts: number };
}

const NOT_FOUND_CODES = new Set<unknown>(['auth/user-not-found', 5]);
const isNotFound = (error: unknown) =>
  typeof error === 'object' && error !== null && NOT_FOUND_CODES.has((error as { code?: unknown }).code);

/** Removes the demo caregiver, its elders (with everything under them), trackers and pairing codes. */
export async function wipeDemo({ db, auth }: Firebase): Promise<void> {
  let uid: string | null = null;
  try {
    uid = (await auth.getUserByEmail(DEMO_EMAIL)).uid;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  if (!uid) return;

  const user = await db.collection('users').doc(uid).get();
  const elderIds: string[] = user.exists ? (user.data()?.elderIds ?? []) : [];
  for (const elderId of elderIds) {
    const ref = db.collection('elders').doc(elderId);
    for (const device of (await ref.collection('devices').get()).docs) await db.collection('deviceIndex').doc(device.id).delete();
    for (const code of (await db.collection('pairingCodes').where('elderId', '==', elderId).get()).docs) await code.ref.delete();
    await auth.deleteUser(elderUid(elderId)).catch((error: unknown) => {
      if (!isNotFound(error)) throw error;
    });
    await db.recursiveDelete(ref);
  }
  await db.collection('users').doc(uid).delete();
  await auth.deleteUser(uid);
}

/** A point `northM` metres north and `eastM` metres east of `from`. */
function offset(from: { lat: number; lng: number }, northM: number, eastM: number) {
  const lat = from.lat + northM / 111_195;
  return { lat, lng: from.lng + eastM / (111_195 * Math.cos((from.lat * Math.PI) / 180)) };
}

interface Step {
  at: Date;
  run: () => Promise<void>;
}

export async function seedDemo({ firebase, logger, password, now: realNow = () => new Date() }: SeedOptions): Promise<SeedResult> {
  const finalNow = realNow();
  let current = new Date(finalNow.getTime() - DAYS_OF_HISTORY * 24 * 60 * MINUTE_MS);
  const clock: Clock = () => new Date(current);
  const at = (date: Date) => {
    current = date;
  };

  await wipeDemo(firebase);

  const services = createServices({ firebase, logger, now: clock });
  const accountPassword = password ?? randomBytes(9).toString('base64url');

  // The account and everything it owns is created a week ago, at a quiet hour.
  const firstDay = localDateOf(current, TIMEZONE);
  at(instantOf(firstDay, '06:00', TIMEZONE));
  const { id: caregiverId } = await services.auth.signup({ name: 'Cuidador Demo', email: DEMO_EMAIL, password: accountPassword });
  const created = await services.elders.create(caregiverId, {
    name: DEMO_ELDER_NAME,
    birthDate: '1948-03-14',
    diagnosisStage: 'early',
    timezone: TIMEZONE,
    missedTaskTimeoutMin: 30,
    safeZone: HOME,
  });
  const elderId = created.id;
  const elder = async () => (await services.repos.elders.get(elderId))!;

  const routines = [];
  for (const seed of ROUTINES) {
    routines.push(
      await services.routines.create(elderId, {
        remindElder: true,
        alertIfMissed: false,
        active: true,
        ...seed,
      }),
    );
  }
  await services.contacts.create(elderId, { name: 'Ana Paula', phone: '+55 19 99123-4567', relation: 'Filha', isEmergency: true, priority: 1 });
  await services.contacts.create(elderId, { name: 'Dr. Roberto Lima', phone: '+55 19 3234-5678', relation: 'Médico', isEmergency: false, priority: 2 });

  at(instantOf(firstDay, '06:30', TIMEZONE));
  const tracker = await services.devices.create(await elder(), { label: 'Rastreador da Maria' });
  const device = await services.devices.authenticate(tracker.deviceId, tracker.secret);

  // The week itself: every step has a time, and only those already in the past are replayed.
  const steps: Step[] = [];
  const elderAuth = { uid: elderUid(elderId), role: 'elder' as const, elderId };
  // The missed-task check normally sweeps every elder; here it may only touch the demo one.
  const missedTasks = createMissedTasksJob({
    elders: { ...services.repos.elders, listAll: async () => [await elder()] },
    routines: services.repos.routines,
    occurrences: services.repos.occurrences,
    events: services.events,
    notifier: services.notifier,
    now: clock,
    logger,
  });

  const today = localDateOf(finalNow, TIMEZONE);
  let confirmation = 0;
  for (let daysAgo = DAYS_OF_HISTORY - 1; daysAgo >= 0; daysAgo--) {
    const date = addDays(today, -daysAgo);
    for (const routine of routines) {
      if (!routine.weekdays.includes(weekdayOf(date))) continue;
      const due = instantOf(date, routine.time, TIMEZONE);
      if (NOT_DONE.has(`${daysAgo}:${routine.name}`)) {
        if (routine.alertIfMissed) {
          steps.push({ at: new Date(due.getTime() + 32 * MINUTE_MS), run: async () => void (await missedTasks.run()) });
        }
        continue;
      }
      const delay = CONFIRM_DELAYS_MIN[confirmation++ % CONFIRM_DELAYS_MIN.length]!;
      steps.push({
        at: new Date(due.getTime() + delay * MINUTE_MS),
        run: async () => void (await services.agenda.markDone(await elder(), elderAuth, date, routine.id)),
      });
    }
  }

  // Two days ago: an SOS from the park.
  const sosAt = instantOf(addDays(today, -2), '16:05', TIMEZONE);
  steps.push({ at: sosAt, run: async () => void (await services.sos.trigger(await elder(), offset(HOME, 400, 250))) });

  // Most mornings she plays a little: the memory game, the colour sequence getting slowly longer, and
  // a round of Jogo da Velha against the phone.
  const games: [number, string, GamePlayedPayload][] = [
    [-6, '10:20', { game: 'memory', pairs: 3, moves: 5, durationSec: 95 }],
    [-5, '10:05', { game: 'sequence', longest: 3, durationSec: 70 }],
    [-4, '10:30', { game: 'memory', pairs: 6, moves: 11, durationSec: 240 }],
    [-3, '10:15', { game: 'sequence', longest: 4, durationSec: 85 }],
    [-3, '10:25', { game: 'memory', pairs: 6, moves: 9, durationSec: 210 }],
    [-2, '10:40', { game: 'tictactoe', level: 'easy', outcome: 'win', durationSec: 60 }],
    [-1, '10:10', { game: 'sequence', longest: 5, durationSec: 110 }],
  ];
  for (const [daysAgo, time, result] of games) {
    steps.push({
      at: instantOf(addDays(today, daysAgo), time, TIMEZONE),
      run: async () => void (await services.games.record(await elder(), result)),
    });
  }

  // Yesterday afternoon: she walks to the bakery, leaves the safe zone, and comes back.
  const walkDay = addDays(today, -1);
  const walkStart = instantOf(walkDay, '15:10', TIMEZONE).getTime();
  const report = (minutes: number, northM: number, eastM: number, battery: number) => ({
    at: new Date(walkStart + minutes * MINUTE_MS),
    run: async () => {
      const point = offset(HOME, northM, eastM);
      await services.location.ingest(device, { ...point, accuracyM: 8, batteryPct: battery, fwVersion: '0.1.0-demo' });
    },
  });
  steps.push(
    report(0, 20, 10, 64),
    report(1, 25, 12, 64),
    report(2, 30, 15, 64),
    report(8, 180, 40, 63),
    report(9, 190, 45, 63),
    report(14, 40, 10, 62),
    report(15, 30, 5, 62),
    {
      at: new Date(walkStart + 11 * MINUTE_MS),
      run: async () =>
        void (await services.location.resolve(await elder(), { note: 'Ana ligou: Maria foi à padaria e já está voltando.' })),
    },
  );

  steps.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const step of steps) {
    if (step.at.getTime() > finalNow.getTime()) continue;
    at(step.at);
    await step.run();
  }

  // The tracker has just checked in, inside the safe zone, with a charged battery.
  at(new Date(finalNow.getTime() - 2 * MINUTE_MS));
  await services.location.ingest(device, { ...offset(HOME, 15, -10), accuracyM: 6, batteryPct: 78, fwVersion: '0.1.0-demo' });

  at(finalNow);
  const pairing = await services.pairing.issueCode(await elder(), caregiverId);

  const elderRef = firebase.db.collection('elders').doc(elderId);
  const count = async (name: string) => (await elderRef.collection(name).count().get()).data().count;
  return {
    email: DEMO_EMAIL,
    password: accountPassword,
    caregiverId,
    elderId,
    elderName: DEMO_ELDER_NAME,
    pairingCode: pairing.code,
    pairingCodeExpiresAt: pairing.expiresAt,
    deviceId: tracker.deviceId,
    deviceSecret: tracker.secret,
    counts: {
      routines: await count('routines'),
      events: await count('events'),
      occurrences: await count('occurrences'),
      contacts: await count('contacts'),
    },
  };
}

const USAGE = `Usage: npm run seed:demo -- --project <firebase-project-id> (--emulators | --yes) [--password <text>]

  --project    Firebase project to seed. Required: nothing is ever seeded by default.
  --emulators  Use the local Auth and Firestore emulators (npm run emulators).
  --yes        Confirm seeding a real project. It deletes and recreates ${DEMO_EMAIL}
               and that account's elders; nothing else is touched.
  --password   Password for the demo caregiver (default: random, printed at the end).
`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      project: { type: 'string' },
      emulators: { type: 'boolean', default: false },
      yes: { type: 'boolean', default: false },
      password: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }
  if (!values.project) {
    console.error(`--project is required.\n\n${USAGE}`);
    process.exit(2);
  }
  if (!values.emulators && !values.yes) {
    console.error(`${values.project} is not an emulator: pass --yes to seed it, or --emulators.\n\n${USAGE}`);
    process.exit(2);
  }
  if (!values.emulators && (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)) {
    console.error('An emulator host is set in this shell, so this run would not reach the real project. Unset it first.');
    process.exit(2);
  }

  const config = loadConfig({
    ...process.env,
    FIREBASE_PROJECT_ID: values.project,
    USE_EMULATORS: String(values.emulators),
    LLM_PROVIDER: 'fake',
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'warn',
  });
  const result = await seedDemo({
    firebase: initFirebase(config),
    logger: createLogger(config),
    ...(values.password ? { password: values.password } : {}),
  });

  const { counts } = result;
  console.log(`
Demo data ready in ${values.project}${values.emulators ? ' (emulators)' : ''}.

  Caregiver login   ${result.email}
  Password          ${result.password}
  Elder             ${result.elderName} (${result.elderId})
  Pairing code      ${result.pairingCode}   valid until ${result.pairingCodeExpiresAt}
  Tracker           id ${result.deviceId}
                    secret ${result.deviceSecret}   (shown only now)

  ${counts.routines} routines, ${counts.occurrences} task records, ${counts.events} timeline events, ${counts.contacts} contacts.

Simulate the tracker:
  npm run simulate:device -- --device-id ${result.deviceId} --secret ${result.deviceSecret} --center ${HOME.lat},${HOME.lng} --radius ${HOME.radiusM}
`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
