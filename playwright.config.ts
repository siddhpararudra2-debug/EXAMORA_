import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    permissions: ["camera"],
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run server",
      url: "http://localhost:4000/api/exams",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // Hermetic email: blank SMTP creds force the mock dispatcher path so
      // E2E never depends on (or hammers) a real SMTP server. dotenv does
      // not override already-set vars, so this wins over .env placeholders.
      env: { SMTP_USER: "", SMTP_PASS: "" },
    },
  ],
});
