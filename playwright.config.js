const { defineConfig, devices } = require('@playwright/test')

// Set BASE_URL to test an app that is already running (it must be in test mode).
// Without it, Playwright starts the app itself on port 3000.
const baseURL = process.env.BASE_URL || 'http://localhost:3000'
const isCI = !!process.env.CI

// API specs need no browser, so they run once in their own project
const API_SPECS = /api[\\/].*\.spec\.js$/

module.exports = defineConfig({
  testDir: './tests/specs',
  globalSetup: require.resolve('./tests/global-setup'),
  outputDir: 'test-results',

  // The app keeps one in-memory data set and every test resets it,
  // so tests must not run at the same time against the same server.
  fullyParallel: false,
  workers: 1,

  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: API_SPECS },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: API_SPECS },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: API_SPECS },
    { name: 'api', testMatch: API_SPECS }
  ],

  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'node server.js',
        url: `${baseURL}/login`,
        env: { NODE_ENV: 'test', PORT: '3000' },
        reuseExistingServer: !isCI,
        timeout: 30_000
      }
})
