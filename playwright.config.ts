import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:4173', headless: true },
  webServer: {
    command: 'vp dev --host 127.0.0.1 --port 4173 --strictPort',
    reuseExistingServer: !process.env.CI,
    url: 'http://127.0.0.1:4173',
  },
});
