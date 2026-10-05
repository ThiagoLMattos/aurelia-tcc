# @aurelia/api

Express 5 + firebase-admin. Implements `/api/v1` from the spec; request and response shapes come
from `@aurelia/shared`.

Implemented: health, signup, `/me` and push tokens, elders, pairing, routines, agenda, contacts,
events (history), weekly report and SOS. Not yet: push sending, the assistant, devices, location and
geofence endpoints, and the scheduler that runs the missed-task job.

Spec §5 lists the endpoints. Where the implementation fills a gap the spec leaves open:

- `POST /auth/pair` answers an unknown, expired or used code with the same `404 NOT_FOUND`, so a
  guess learns nothing. It is limited to 10 requests per 15 minutes per IP.
- Marking a task done returns the updated agenda item (200). A task that already has an occurrence,
  whether done or missed, answers `409`.
- Undoing a confirmation deletes the occurrence and keeps the original `taskDone` event, flagged with
  `payload.undoneAt`; it appends nothing.
- `GET /elders/:elderId` returns `devices` from `elders/{id}/devices`; registering trackers comes later.
- An elder document carries `phonePairedAt` (set on pairing, cleared on unpairing). Pairing a new
  phone also clears the previous phone's push tokens.

## Missed-task job

`createServices(...).missedTasks.run(now)` marks overdue `alertIfMissed` tasks as missed, once each,
and returns what it created so the caller can notify caregivers. It looks at today and yesterday in
the elder's timezone, and skips a routine created after its time that day. Nothing schedules it yet.

## Not carried over from the old API

Diary, games and communication logs are out of scope for v1. If they come back they should be
designed against the current data model rather than ported.

## Layout

```
src/
  server.ts        loads the root .env, reads config, listens
  app.ts           createApp(deps): builds the Express app without listening (tests use this)
  config.ts        zod-validated environment; fails fast with a list of what is wrong
  firebase.ts      initializes firebase-admin once (emulators or Application Default Credentials)
  http/            AppError, error handler, validate() middleware, rate-limit helper
  auth/            authenticate (ID token + custom claims), requireRole, requireElderAccess
  services.ts      wires repos into services; routes, tests and jobs share this graph
  clock.ts         injectable `now`, so time-dependent logic is testable
  modules/         routes + service per feature (auth, me, elders, pairing, routines, agenda,
                   contacts, events, reports, sos, jobs)
  repos/           the only code that touches Firestore; converters live here
test/              vitest + supertest against the Firebase emulators
```

## Environment

There is a single `.env` at the **repository root** (copy `.env.example`). The API reads:

| Variable | Notes |
|---|---|
| `FIREBASE_PROJECT_ID` | required |
| `USE_EMULATORS` | `true` → local Auth/Firestore emulators, no credentials needed |
| `GOOGLE_APPLICATION_CREDENTIALS` | path to a service-account JSON; only when `USE_EMULATORS=false` |
| `PORT` | default `3000` |
| `CORS_ORIGINS` | comma-separated; empty disables CORS (native apps don't need it) |
| `LOG_LEVEL` | `info` by default; `silent` in tests |

## Run against the emulators (no Firebase project needed)

The emulators need **Java 11+** (Java 21 recommended). On macOS: `brew install openjdk@21`, then
`export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"`.

```bash
npm run emulators      # terminal 1: Auth on 9099, Firestore on 8080, UI on 4000
USE_EMULATORS=true FIREBASE_PROJECT_ID=demo-aurelia npm run dev:api   # terminal 2
```

## Tests

```bash
npm run test:api
```

This starts the emulators, runs `vitest`, and stops them. Test files run one at a time and each
starts from empty Auth and Firestore emulators.

## Run against a real Firebase project

1. In the Firebase console create a service account key and save it outside git, for example
   `apps/api/service-account.json` (ignored by `.gitignore`).
2. In the root `.env` set `USE_EMULATORS=false`, `FIREBASE_PROJECT_ID=<your project id>` and
   `GOOGLE_APPLICATION_CREDENTIALS=./apps/api/service-account.json`.
3. `npm run dev:api`.
