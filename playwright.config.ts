import { defineConfig, devices } from '@playwright/test';
const port = Number(process.env.PLAYWRIGHT_PORT || 3100);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({ testDir: './e2e', fullyParallel: false, use: { baseURL, trace: 'retain-on-failure' }, webServer: { command: `npm run dev -- --port ${port}`, url: baseURL, reuseExistingServer: false }, projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }] });
