/**
 * Stands in for the ESP32 tracker: posts positions to POST /device/location exactly as the firmware
 * will (docs/device-protocol.md), so the geofence flow can be demoed and tested without hardware.
 *
 *   npm run simulate:device -- --device-id <id> --secret <secret> --center -22.9056,-47.0608 --radius 100
 */
import { DeviceLocationBodySchema, type DeviceLocationBody } from '@aurelia/shared';
import { parseArgs } from 'node:util';

import { SCENARIOS, scenario, type ScenarioName } from './scenarios';

/** The API accepts one report per device every 10 s. */
const MIN_INTERVAL_S = 10;
/** Doc §Cadence: back off up to five minutes on 5xx. */
const MAX_BACKOFF_S = 300;

const USAGE = `Usage: npm run simulate:device -- [options]

  --api <url>          API base, default $AURELIA_API or http://localhost:3000/api/v1
  --device-id <id>     from the tracker screen (or $AURELIA_DEVICE_ID)
  --secret <secret>    shown once when the tracker was registered (or $AURELIA_DEVICE_SECRET)
  --center <lat,lng>   centre of the safe zone, default -22.9056,-47.0608
  --radius <metres>    radius of the safe zone, default 100
  --scenario <name>    ${SCENARIOS.join(' | ')}, default walk-out-and-back
  --interval <secs>    between reports, default 12 (the API allows one per ${MIN_INTERVAL_S} s)
  --seed <n>           makes the jitter / wander repeatable, default 1
  --dry-run            print the positions without sending anything
`;

const { values } = parseArgs({
  options: {
    api: { type: 'string' },
    'device-id': { type: 'string' },
    secret: { type: 'string' },
    center: { type: 'string', default: '-22.9056,-47.0608' },
    radius: { type: 'string', default: '100' },
    scenario: { type: 'string', default: 'walk-out-and-back' },
    interval: { type: 'string', default: '12' },
    seed: { type: 'string', default: '1' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function fail(message: string): never {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(2);
}

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}

const api = (values.api ?? process.env.AURELIA_API ?? 'http://localhost:3000/api/v1').replace(/\/+$/, '');
const deviceId = values['device-id'] ?? process.env.AURELIA_DEVICE_ID;
const secret = values.secret ?? process.env.AURELIA_DEVICE_SECRET;
const dryRun = values['dry-run'] ?? false;
if (!dryRun && (!deviceId || !secret)) fail('--device-id and --secret are required (or use --dry-run).');

const [lat, lng, ...extra] = (values.center ?? '').split(',').map(Number);
if (lat === undefined || lng === undefined || extra.length > 0 || !Number.isFinite(lat) || !Number.isFinite(lng)) fail('--center must be "lat,lng".');
const radiusM = Number(values.radius);
if (!Number.isFinite(radiusM) || radiusM <= 0) fail('--radius must be a positive number of metres.');
const name = values.scenario as ScenarioName;
if (!SCENARIOS.includes(name)) fail(`--scenario must be one of: ${SCENARIOS.join(', ')}.`);
const intervalS = Number(values.interval);
if (!Number.isFinite(intervalS) || intervalS <= 0) fail('--interval must be a positive number of seconds.');
if (intervalS < MIN_INTERVAL_S && !dryRun) console.warn(`! --interval ${intervalS}s is under the ${MIN_INTERVAL_S}s limit: expect 429 responses.`);
const seed = Number(values.seed);

const sleep = (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));
const stamp = () => new Date().toISOString().slice(11, 19);

async function post(body: DeviceLocationBody): Promise<Response> {
  return fetch(`${api}/device/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': deviceId as string, 'X-Device-Secret': secret as string },
    body: JSON.stringify(body),
  });
}

/** Sends one report, following the firmware rules: 401/400 stop the run, 429 and 5xx retry the same fix. */
async function send(body: DeviceLocationBody): Promise<boolean> {
  let backoff = intervalS;
  for (;;) {
    let line: string;
    let retryIn: number | null = null;
    try {
      const response = await post(body);
      const text = await response.text();
      line = `${response.status} ${text.trim() || '(no body)'}`;
      if (response.ok) {
        console.log(`  ← ${line}`);
        return true;
      }
      if (response.status === 400 || response.status === 401) {
        console.error(`  ← ${line}\n\nStopping: ${response.status === 401 ? 'the credentials were rejected' : 'the body was rejected'}; a real tracker would not retry.`);
        return false;
      }
      retryIn = response.status === 429 ? intervalS : Math.min(backoff, MAX_BACKOFF_S);
      if (response.status >= 500) backoff = Math.min(backoff * 2, MAX_BACKOFF_S);
    } catch (error) {
      line = `network error: ${error instanceof Error ? error.message : String(error)}`;
      retryIn = Math.min(backoff, MAX_BACKOFF_S);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_S);
    }
    console.warn(`  ← ${line} — retrying in ${retryIn}s`);
    await sleep(retryIn);
  }
}

async function main() {
  console.log(`${dryRun ? 'Dry run of' : 'Simulating'} "${name}" around ${lat},${lng} (radius ${radiusM} m), one report every ${intervalS}s${dryRun ? '' : ` → ${api}`}`);
  let battery = 81;
  let n = 0;
  for (const position of scenario(name, { center: { lat: lat as number, lng: lng as number }, radiusM, seed })) {
    n += 1;
    const body: DeviceLocationBody = DeviceLocationBodySchema.parse({
      lat: Number(position.lat.toFixed(6)),
      lng: Number(position.lng.toFixed(6)),
      accuracyM: 8,
      batteryPct: Math.max(1, battery),
      fwVersion: '0.1.0-sim',
    });
    console.log(`[${stamp()}] #${n} POST /device/location ${JSON.stringify(body)}`);
    if (!dryRun && !(await send(body))) process.exit(1);
    if (n % 10 === 0) battery -= 1;
    await sleep(dryRun ? 0 : intervalS);
  }
  console.log('Scenario finished.');
}

// Piping into `head` and the like closes stdout early; that is not an error.
process.stdout.on('error', () => process.exit(0));
process.on('SIGINT', () => {
  console.log('\nStopped.');
  process.exit(0);
});
void main();
