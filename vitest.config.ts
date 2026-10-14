import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.{ts,tsx}'], testTimeout: 60000, hookTimeout: 60000, environmentOptions: { jsdom: { url: 'http://localhost' } } } });
