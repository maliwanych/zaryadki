// Автотесты открывают приложение в настоящем браузере (Chromium) с экраном телефона.
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // один из тестов временно меняет app/sw.js — параллельно нельзя
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:8765/",
    locale: "ru-RU",
    timezoneId: "Europe/Minsk",
    viewport: { width: 400, height: 860 },
    serviceWorkers: "allow",
    acceptDownloads: true,
    // В облачной среде Claude браузер уже установлен в /opt/pw-browsers
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 400, height: 860 } } }],
  webServer: {
    command: "npx http-server app -p 8765 -c-1 --silent",
    url: "http://localhost:8765/",
    reuseExistingServer: !process.env.CI,
  },
});
