# API reference

Base path `/api/v1`, JSON only. Authenticated routes send `Authorization: Bearer <Firebase ID token>`.
Request and response shapes are the zod schemas of the same name in `@aurelia/shared`.

Errors always look like `{ "error": { "code", "message", "details?" } }`:

| Code | HTTP |
|---|---|
| `VALIDATION_ERROR` | 400 |
| `UNAUTHENTICATED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `RATE_LIMITED` | 429 |
| `INTERNAL` | 500 |
| `SERVICE_UNAVAILABLE` | 503 |

Every `/elders/:elderId/**` route first checks access: a caregiver must be in the elder's
`caregiverIds`, an elder token must carry the same `elderId`. "Who" below is the extra role check.

## Public and account

| Endpoint | Who | Notes |
|---|---|---|
| `GET /health` | public | |
| `POST /auth/signup` | public, 10/hour/IP | `SignupBody` → `201 { id }` |
| `POST /auth/pair` | public, 10/15 min/IP | `PairBody` → `PairResponse`; a bad, expired or used code is `404` |
| `GET /me` | any | `MeResponse` |
| `PATCH /me` | caregiver | `PatchMeBody` |
| `POST /me/push-tokens` | any | `PushTokenBody`; elder tokens are stored on the elder |
| `DELETE /me/push-tokens/:token` | any | |
| `POST /me/elders` | caregiver, 10/15 min/IP | `JoinElderBody` → `201 Elder`; joins the elder another caregiver invited them to; a bad, expired or used invite is `404` |
| `DELETE /me` | caregiver | `204`; deletes the account and every elder no other caregiver follows (with all its data, trackers and the elder phone's login); a shared elder stays with the other caregivers. The app asks for the password first |

## Elders

| Endpoint | Who | Notes |
|---|---|---|
| `POST /elders` | caregiver | `CreateElderBody` → `201 Elder` |
| `GET /elders/:elderId` | both | `ElderDetailResponse` (profile, safe zone, location state, devices) |
| `PATCH /elders/:elderId` | caregiver | `PatchElderBody` |
| `POST /elders/:elderId/pairing-codes` | caregiver | `PairingCodeResponse` (15 min) |
| `DELETE /elders/:elderId/session` | caregiver | unpair the elder phone |
| `POST /elders/:elderId/caregiver-invites` | caregiver | `PairingCodeResponse` (48 h) for another caregiver to type in `POST /me/elders`; replaces the elder's earlier unused invite. It never signs a phone in |
| `GET /elders/:elderId/caregivers` | caregiver | `ElderCaregiversResponse`: who follows the elder (id, name, email) |
| `DELETE /elders/:elderId/caregivers/:caregiverId` | caregiver | `204`; any caregiver of the elder can remove another or leave; `409` for the last one |

## Routines, agenda, contacts

| Endpoint | Who | Notes |
|---|---|---|
| `GET /elders/:elderId/routines` | both | |
| `POST /elders/:elderId/routines` | caregiver | `CreateRoutineBody` |
| `PATCH /elders/:elderId/routines/:routineId` | caregiver | `PatchRoutineBody` |
| `DELETE /elders/:elderId/routines/:routineId` | caregiver | soft delete (`active: false`) |
| `GET /elders/:elderId/agenda?date=` | both | `AgendaResponse`, today by default |
| `POST /elders/:elderId/agenda/:date/:routineId/done` | both | returns the `AgendaItem`; elder: today only; pushes caregivers with `notifyConfirmations` when the elder confirms |
| `DELETE /elders/:elderId/agenda/:date/:routineId/done` | caregiver | undo |
| `GET /elders/:elderId/contacts` | both | by priority |
| `POST /elders/:elderId/contacts` | both | `CreateContactBody` |
| `PATCH /elders/:elderId/contacts/:contactId` | both | `PatchContactBody` |
| `DELETE /elders/:elderId/contacts/:contactId` | both | |

## History, reports, alerts

| Endpoint | Who | Notes |
|---|---|---|
| `GET /elders/:elderId/events?from=&to=&types=&limit=&cursor=` | caregiver | `EventsPage`, newest first |
| `GET /elders/:elderId/reports/weekly?weekStart=` | caregiver | `WeeklyReport` |
| `POST /elders/:elderId/sos` | elder | `SosBody` → `201 { eventId }`; urgent push to every caregiver |
| `POST /elders/:elderId/games` | elder | `GameResultBody` → `201 { eventId }`; a finished game, stored as a `gamePlayed` event (no push) |
| `POST /elders/:elderId/geofence/resolve` | caregiver | `ResolveGeofenceBody` → updated `geofenceExit` event; does not change the location state |
| `POST /elders/:elderId/events/:eventId/acknowledge` | caregiver | no body → updated `sos` / `geofenceExit` event with `acknowledgedAt` and `acknowledgedBy`; the first caregiver wins, repeating it is harmless; `404` for any other event |

### Escalation

When at least one of the elder's caregivers has `settings.escalation: 'meThenContacts'`, an `sos` or
`geofenceExit` that nobody acknowledged (or resolved) within `ESCALATE_AFTER_MIN` (5) minutes is
texted to every emergency contact, once. A safe-zone exit only escalates while the elder is still
outside and it is the latest exit; alerts older than `ESCALATION_WINDOW_MIN` (60) are left alone. The
alert gets `escalatedAt`, the timeline a `contactsAlerted` event (who the SMS reached and who it did
not), and every caregiver a `contactsAlerted` push. SMS go through Twilio when `SMS_PROVIDER=twilio`;
the default, `log`, only logs them.

## Trackers and location

| Endpoint | Who | Notes |
|---|---|---|
| `POST /elders/:elderId/devices` | caregiver | `CreateDeviceBody` → `201 { deviceId, secret }`; the secret is shown once |
| `DELETE /elders/:elderId/devices/:deviceId` | caregiver | `204` |
| `GET /elders/:elderId/location` | caregiver | `LocationResponse` |
| `POST /device/location` | tracker | headers `X-Device-Id` + `X-Device-Secret`; `DeviceLocationBody` → `{ ok: true }`; one report per 10 s per device (`429`) |

## Assistant

| Endpoint | Who | Notes |
|---|---|---|
| `POST /elders/:elderId/assistant/messages` | both | `AssistantMessageBody` → `{ reply }`; 30/hour/elder; `503` when the model fails or takes over 15 s |

### Daily summary

"Insights da Aurélia": from `DAILY_SUMMARY_TIME` (20:00, elder's time), the jobs run asks the model for
a short summary of the elder's day, once per elder per day, when at least one caregiver has
`settings.notifyAssistantInsights` on and the day had a routine due or something on the timeline. It
is stored as a `dailySummary` event and pushed (type `dailySummary`) to those caregivers. A failed
attempt is retried on the next run.

## Operations

| Endpoint | Who | Notes |
|---|---|---|
| `POST /internal/jobs/run` | `X-Jobs-Token` | only mounted when `JOBS_TOKEN` is set; runs the missed-task, device-offline and escalation checks and the daily summaries; `409` if a run is in progress |
| `POST /internal/jobs/escalate` | `X-Jobs-Token` | only the escalation check, for a scheduler that calls it every minute → `{ alertsEscalated }`; `409` if one is in progress |

## Push `data`

Every push carries `{ type, elderId, eventId? }` (`PushData`), with `type` one of `sos`,
`geofenceExit`, `geofenceReturn`, `taskMissed`, `taskDone`, `deviceOffline`, `contactsAlerted`,
`dailySummary`.
