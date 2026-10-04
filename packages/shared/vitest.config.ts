import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/agenda.ts', 'src/geo.ts', 'src/report.ts', 'src/time.ts'],
    },
  },
});
