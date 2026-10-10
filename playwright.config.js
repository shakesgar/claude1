const path = require('path')
const { defineConfig, devices } = require('@playwright/test')
const { loadTestSettings, isWorker } = require('./config/testSettings')

// Run settings a person can edit without touching this file (see TESTING.md).
// Command-line flags such as --headed and environment variables such as SLOWMO take priority over them.
const settings = loadTestSettings(path.join(__dirname, 'testsettings.json'))

const launchOptions = { slowMo: settings.slowMo }

// A maximised window needs a visible browser, and only Chromium supports it
const maximize = settings.maximized && !settings.headless
if (settings.maximized && settings.headless && !isWorker) {
  console.log('testsettings: "maximized" has no effect when "headless" is true, running at the normal size')
}

function chromiumUse() {
  if (!maximize) return { ...devices['Desktop Chrome'] }
  // viewport: null makes the page follow the real window size, and cannot be combined with deviceScaleFactor
  const { deviceScaleFactor, ...device } = devices['Desktop Chrome']
  return {
    ...device,
    viewport: null,
    launchOptions: { ...launchOptions, args: [...(launchOptions.args || []), '--start-maximized'] }
  }
}

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
    headless: settings.headless,
    launchOptions,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  projects: [
    { name: 'chromium', use: chromiumUse(), testIgnore: API_SPECS },
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
