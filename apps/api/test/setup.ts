import { beforeAll } from 'vitest';

const project = process.env.FIREBASE_PROJECT_ID!;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST!;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST!;

async function clear(url: string, what: string) {
  let response: Response;
  try {
    response = await fetch(url, { method: 'DELETE' });
  } catch {
    throw new Error(
      `Cannot reach the ${what} emulator. Run the API tests with \`npm run test:api\` (it starts the emulators).`,
    );
  }
  if (!response.ok) throw new Error(`Clearing the ${what} emulator failed: ${response.status}`);
}

// Every test file starts from empty Firestore and Auth emulators.
beforeAll(async () => {
  await clear(`http://${firestoreHost}/emulator/v1/projects/${project}/databases/(default)/documents`, 'Firestore');
  await clear(`http://${authHost}/emulator/v1/projects/${project}/accounts`, 'Auth');
});
