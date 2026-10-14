import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:3000', headless: true, screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:3000',
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },
});
