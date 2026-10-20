import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173/wfc/",
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
    video: "on",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173/wfc/",
    reuseExistingServer: true,
  },
});
