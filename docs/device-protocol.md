# Tracker protocol (ESP32 + GPS NEO-6M)

What the tracker must do to talk to the Aurélia API. It is the contract the firmware is written against;
the request and response shapes are the zod schemas of the same name in `@aurelia/shared`
(`packages/shared/src/device.ts`), and the endpoint is also listed in [api.md](api.md).

The whole job of the tracker is to report where it is. It never reads anything back: the API decides
whether the elder is inside or outside the safe zone and who gets notified.

## Provisioning

1. In the app, the caregiver opens the tracker screen and registers the tracker with a label.
2. The app shows a `deviceId` and a `secret` **once**. The secret is stored only as a hash; it cannot be
   shown again. If it is lost, delete the tracker in the app and register a new one.
3. Both values go into the firmware configuration (a config header, or a serial / Wi-Fi setup portal),
   together with the Wi-Fi credentials and the API base URL.

Treat the secret like a password: do not log it, and do not commit a config header that contains it.

## Request

```
POST {API_URL}/device/location        e.g. https://api.example.com/api/v1/device/location
X-Device-Id: <deviceId>
X-Device-Secret: <secret>
Content-Type: application/json

{ "lat": -22.9056, "lng": -47.0608, "accuracyM": 8, "batteryPct": 81, "fwVersion": "0.1.0" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `lat` | number | yes | decimal degrees, −90…90 |
| `lng` | number | yes | decimal degrees, −180…180 |
| `accuracyM` | number ≥ 0 | no | estimated horizontal error in metres (for example HDOP × the receiver's base error) |
| `batteryPct` | number 0…100 | no | |
| `fwVersion` | string ≤ 40 | no | |

The body is strict: **any other field is rejected with 400**. Send numbers, not strings, and leave a
field out rather than sending `null`. Keep the JSON in the low hundreds of bytes (the API accepts up to 100 kB).

## Responses

| Status | Meaning | What the tracker does |
|---|---|---|
| `200` `{ "ok": true }` | accepted | wait for the next report. Treat any 2xx as success. |
| `400` | the body is invalid | do not retry the same body. Fix the firmware; drop this fix and carry on with the next. |
| `401` | unknown id or wrong secret (the two are indistinguishable) | **stop sending** and signal an error (blink the error LED). Retrying cannot help; the tracker has to be re-provisioned. |
| `429` | more than one report per 10 s | wait at least 10 s, then send the latest fix. |
| `5xx`, timeout, no connection | server or network trouble | retry with exponential backoff: 10 s, 20 s, 40 s … capped at 5 min. Keep only the latest fix; do not queue stale ones. |

Errors carry `{ "error": { "code", "message" } }`; the tracker does not need to parse it.

Limits the firmware can run into: one report per device every 10 s, and 120 requests per minute per IP
address (several trackers behind one router share that).

## Cadence

- **Moving:** every 30 s. **Stationary:** every 2 min. Decide "moving" from the distance between
  consecutive fixes (a few tens of metres) rather than from raw speed, which is noisy on a NEO-6M.
- **Never faster than one report per 10 s**, whatever the situation.
- **Only send with a fix.** Without one (cold start, indoors) skip the report; do not send the last
  known position as if it were new.
- Keep reporting while stationary. The API marks a tracker **offline after 15 minutes of silence** and
  warns the caregiver, so a 2-minute cadence leaves plenty of room.

How fast an alert comes: the API changes the elder's status only after **two consecutive readings on the
same side** of the zone, and a reading within 15 m of the edge counts for neither side. So leaving the
zone is reported roughly 30–60 s after crossing while moving, and up to about 2 min while stationary.
The API judges position only (`accuracyM` is stored, not used), so the fix should already be as good as
the receiver can make it: send readings with a reasonable HDOP.

## Transport

- **HTTPS** in production: `WiFiClientSecure` with the root CA of the API's host. `setInsecure()` is for
  local development against `http://` only.
- Certificate validation needs the right time, so sync the clock (NTP) after connecting to Wi-Fi and before
  the first request.
- **Connectivity is Wi-Fi in v1.** That is a known limitation: outdoors the tracker works only within
  range of a known network, a phone hotspot or a GSM module. A GSM variant is out of scope for the TCC.

## Testing without hardware

`scripts/simulate-device.ts` sends the same requests the firmware will:

```bash
npm run simulate:device -- --device-id <id> --secret <secret> \
  --center -22.9056,-47.0608 --radius 100 --scenario walk-out-and-back
```

`--center` and `--radius` must match the safe zone set in the app. Scenarios: `stay-inside`, `walk-out-and-back`
(one `geofenceExit`, then one `geofenceReturn`, then it ends) and `wander` (random walk that keeps crossing
the edge). `--interval` is in seconds (default 12; under 10 you will see `429`), `--api` defaults to
`http://localhost:3000/api/v1`, `--dry-run` prints the positions without sending, and `--help` lists everything.
The simulator follows the response rules above, including stopping on `401` and backing off on `5xx`.
