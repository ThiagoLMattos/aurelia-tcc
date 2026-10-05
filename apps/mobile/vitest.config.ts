import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Only the app's plain TypeScript (API client, env, routing, mock backend) is tested here;
// screens and anything that imports react-native are checked by running the app.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url).href) } },
  test: {
    include: ['test/**/*.test.ts'],
    // config/env.ts parses the environment when it is first imported.
    env: { EXPO_PUBLIC_API_MODE: 'mock' },
  },
});
