# @aurelia/api

Express 5 + firebase-admin. Implements `/api/v1` from the spec; request and response shapes come
from `@aurelia/shared`.

Every row of spec §5 is implemented; `docs/api.md` lists them with their roles and shared schemas.

Spec §5 lists the endpoints. Where the implementation fills a gap the spec leaves open:

- `POST /auth/pair` answers an unknown, expired or used code with the same `404 NOT_FOUND`, so a
  guess learns nothing. It is limited to 10 requests per 15 minutes per IP.
- Marking a task done returns the updated agenda item (200). A task that already has an occurrence,
  whether done or missed, answers `409`.
- Undoing a confirmation deletes the occurrence and keeps the original `taskDone` event, flagged with
  `payload.undoneAt`; it appends nothing.
- `GET /elders/:elderId` returns `devices` (id, label, last contact, battery) from `elders/{id}/devices`.
- `SERVICE_UNAVAILABLE` (503) is a new error code, used when the assistant's model fails or times out.
- `deviceOffline` is a new push type (it is also an event type already), sent on the `reminders` channel.
- `GET /elders/:elderId/location` also returns `safeZone` and `deviceLastSeenAt`.
- `POST /elders/:elderId/geofence/resolve` returns the updated `geofenceExit` event. It resolves the
  latest unresolved exit unless `eventId` is given; there is no pending exit → `404`, already resolved → `409`.
- An elder document carries `phonePairedAt` (set on pairing, cleared on unpairing). Pairing a new
  phone also clears the previous phone's push tokens.

## Push notifications

`src/push/`: `PushSender` (Expo, chunked, receipts not checked) and `notify.ts`, one function per
event with the pt-BR text and the `data` the app routes on. SOS and geofence go to every caregiver on
the `alerts` channel with high priority; missed tasks and confirmations go only to caregivers who
turned `notifyMissedTask` / `notifyConfirmations` on; a tracker going offline goes to everyone on
`reminders`. Tokens Expo reports as `DeviceNotRegistered` are removed. A failing push is logged and
never fails the request or the job. Tests inject a fake sender; `createServices` defaults to one that
sends nothing, and only `server.ts` wires the real one.

## Trackers and geofence

- `POST /elders/:id/devices` returns `{ deviceId, secret }` once. Only `sha256(secret)` is stored,
  and `deviceIndex/{deviceId}` → `elderId` lets a report find its elder with one read.
- `POST /device/location` authenticates with `X-Device-Id` + `X-Device-Secret` (constant-time hash
  comparison; unknown id and wrong secret look the same). A tracker may report once per 10 seconds;
  unauthenticated callers are also capped per IP.
- The shared `nextLocationState()` runs in a transaction on the elder, together with the transition's
  event, so concurrent reports cannot emit it twice. The push goes out after the commit.
- With no safe zone the position is still stored, but the status stays `unknown`.
- A tracker silent for 15 minutes (a tracker that never reported counts from its registration) gets
  one `deviceOffline` event and push per silence; reporting again re-arms it.

## Jobs

`createServices(...).jobs.runAll(now)` runs the missed-task check and the device-offline check and
refuses to start while a previous run is still going. `server.ts` schedules it every 5 minutes with
`node-cron` (set `SCHEDULER_ENABLED=false` to turn that off). The scheduler never runs in tests.

If the API is deployed with scale-to-zero (e.g. Cloud Run) an in-process timer cannot be relied on.
Set `JOBS_TOKEN` (16+ characters) and have an external scheduler call
`POST /api/v1/internal/jobs/run` with the header `X-Jobs-Token`; the route is not mounted without a
token, and answers `409` if a run is already in progress.

The missed-task job looks at today and yesterday in the elder's timezone and skips a routine created
after its time that day.

## Assistant

`LlmProvider.generate({ system, messages, signal })`. `LLM_PROVIDER=groq` uses `groq-sdk` with
`LLM_MODEL` and `GROQ_API_KEY` (both required then; pick a model from Groq's current list, none is
hard-coded); `LLM_PROVIDER=fake` answers deterministically without a key. The system prompt is built
per role from the elder's profile and today's agenda; caregivers also get a compact JSON summary of the
last 7 days. Contacts, phone numbers and caregiver emails are never sent. History is capped at 20
turns of 2,000 characters, the limit is 30 messages per hour per elder (shared by its caregivers and
its phone), and a failure or a 15-second timeout answers `503` with a friendly message. Conversations
are not stored.

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
                   contacts, events, reports, sos, devices, location, assistant, jobs)
  push/            PushSender (Expo) and per-event notifications
  jobs/            node-cron scheduler (started by server.ts only)
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
| `LLM_PROVIDER` | `groq` (default) or `fake` |
| `GROQ_API_KEY`, `LLM_MODEL` | required when `LLM_PROVIDER=groq` |
| `JOBS_TOKEN` | optional, 16+ characters; enables `POST /internal/jobs/run` |
| `SCHEDULER_ENABLED` | default `true`; `false` disables the in-process scheduler |

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

## Running in production

`npm run build -w @aurelia/api` bundles the API (and `@aurelia/shared`) into `dist/server.mjs`;
`npm run start:prod -w @aurelia/api` runs it with plain Node. The root `Dockerfile` does the same inside
an image. Environment variables are listed in `.env.example`; the Cloud Run service is `deploy/cloud-run.yaml`. Behind a proxy
set `TRUST_PROXY` (Cloud Run: `1`) so the per-IP rate limits see each client's address.

## Demo data

`npm run seed:demo -- --project demo-aurelia --emulators` (or `--project <id> --yes` for a real project)
creates the demo caregiver and Maria with a week of history, a tracker and a fresh pairing code. It
wipes only that account first and never runs without `--project`.
