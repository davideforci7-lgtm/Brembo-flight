import { defineConfig, devices } from "@playwright/test";

const chromiumLaunch = {
  executablePath: process.env.BREMBO_CHROMIUM_EXECUTABLE || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--enable-unsafe-swiftshader",
    ...(process.env.BREMBO_CHROMIUM_EXECUTABLE
      ? ["--no-zygote", "--disable-dev-shm-usage"]
      : []),
  ],
};

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 12000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173/Brembo-flight/",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions: chromiumLaunch,
      },
    },
    {
      name: "chromium-touch",
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 629 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        launchOptions: chromiumLaunch,
      },
    },
    {
      name: "webkit-iphone",
      use: { ...devices["iPhone 13 Mini"], defaultBrowserType: "webkit" },
    },
  ],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/Brembo-flight/",
    reuseExistingServer: !process.env.CI,
  },
});
