import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "off",
    headless: true,
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: [
    {
      env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
      command: "npm run dev -- --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      // Signed-in flows (e2e/startup.spec.js): Supabase calls go to a mock origin answered in-test.
      env: { VITE_SUPABASE_URL: "http://supabase.mock.test", VITE_SUPABASE_ANON_KEY: "mock-anon-key" },
      command: "npm run dev -- --port 5175 --strictPort",
      url: "http://127.0.0.1:5175",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
