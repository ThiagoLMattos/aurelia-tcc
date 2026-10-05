# @aurelia/mobile

Expo SDK 54 app with both sides of Aurélia: the caregiver's and the elder's. The server decides which
side someone sees (the `role` claim on their Firebase token); the app only reads it.

## Run it

Install once at the repository root (`npm install`), then from the root:

```bash
npm run dev:mobile      # Expo Go (expo start --go)
npm run start:dev -w @aurelia/mobile   # development build (expo start --dev-client)
```

### Without a backend (mock mode)

Create `apps/mobile/.env` (Expo reads `.env` from the app folder, not from the repository root):

```
EXPO_PUBLIC_API_MODE=mock
```

The app then runs on an in-memory backend: no API, no Firebase. Data resets whenever the app reloads.
Sign in as the seeded caregiver `demo@aurelia.app` / `demo1234` (it already has an elder), or sign up
a new one and go through the "create elder" step. To use the elder side, choose "Sou o idoso" and
enter the code `DEMA23`.

### Against the real API

`apps/mobile/.env` needs the Firebase web config (public by design) and the API address:

```
EXPO_PUBLIC_API_MODE=api
EXPO_PUBLIC_API_URL=http://<your computer's LAN IP>:3000/api/v1
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_EAS_PROJECT_ID=...   # only needed for push
```

If a variable is missing the app stops at start-up with a message listing what to fill in.

### Run on a phone

A phone cannot reach `localhost`, so `EXPO_PUBLIC_API_URL` must use the computer's address on the
local network (for example `http://192.168.0.10:3000/api/v1`), with the phone on the same Wi-Fi.
Restart Metro after changing `.env`.

Expo Go works for everything except push on **Android** (Expo removed it from Expo Go in SDK 53). For
that, make a development build, logging in to EAS yourself first:

```bash
cd apps/mobile
eas build --profile development --platform android
npm run start:dev
```

iOS push works in Expo Go. Push never works on simulators; use a real phone. To try a tap by hand, take
the token the app registered (`users/{uid}.pushTokens` or `elders/{id}.pushTokens`) and send it from
https://expo.dev/notifications with the data `{"type":"sos","elderId":"<id>"}`: tapping it opens the SOS alert.

## Layout

```
app/                     routes (expo-router)
  index.tsx              sends each visitor to their side
  (auth)/                welcome, login, signup, pair      → signed out
  (caregiver)/           onboarding + tabs + modals        → role caregiver
  (elder)/               elder screens                     → role elder
src/
  config/env.ts          EXPO_PUBLIC_* parsed with zod
  lib/firebase.ts        Firebase Auth only (the app never reads Firestore)
  lib/api/               client.ts (fetch, token, errors), endpoints.ts (one function per route,
                         responses validated with @aurelia/shared), mock.ts (in-memory twin)
  lib/backend.ts         picks real or mock from EXPO_PUBLIC_API_MODE
  lib/query.ts           TanStack Query client and query keys
  auth/                  SessionProvider (role from token claims), useMe
  push/                  permission, Android channels, token registration, tap routing
  theme/                 colour, type and spacing tokens, `caregiver` and `elder` palettes
  components/            Screen, Button, Card, TextField, loading / empty / error states
```

Routes are only reachable by the right role (`Stack.Protected`), and signing out clears the query cache.
Hrefs include the group, for example `/(elder)/sos`, because both sides have an `assistant` screen.

`context/`, `services/` and `data/` are the old mock-backed state the caregiver and elder screens still
read; they go away as those screens move to `lib/api`.

## Checks

```bash
npm run typecheck -w @aurelia/mobile
npm run lint -w @aurelia/mobile
npm test -w @aurelia/mobile      # API client, env, errors, push routing, mock backend
```
