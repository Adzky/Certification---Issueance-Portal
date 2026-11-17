import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@app': path.resolve(root, 'app'),
      '@': path.resolve(root, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    globalSetup: ['tests/setup/global.ts'],
    env: { DATABASE_URL: 'file:./test.db' },
  },
});
