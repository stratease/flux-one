import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['assets/js/src/**/*.test.ts', 'assets/js/src/**/*.test.tsx'],
  },
});
