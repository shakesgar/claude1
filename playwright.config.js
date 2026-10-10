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

// Options for a Chromium-based project. A channel selects a browser installed on the machine
// (Google Chrome or Microsoft Edge) instead of the Chromium that Playwright downloads.
function chromiumUse(deviceName, channel) {
  const base = { ...devices[deviceName], ...(channel ? { channel } : {}) }
  if (!maximize) return base
  // viewport: null makes the page follow the real window size, and cannot be combined with deviceScaleFactor
  const { deviceScaleFactor, ...device } = base
  return {
    ...device,
    viewport: null,
    launchOptions: { ...launchOptions, args: [...(launchOptions.args || []), '--start-maximized'] }
  }
}

const BROWSER_PROJECTS = {
  chromium: chromiumUse('Desktop Chrome'),
  firefox: { ...devices['Desktop Firefox'] },
  webkit: { ...devices['Desktop Safari'] },
  chrome: chromiumUse('Desktop Chrome', 'chrome'),
  msedge: chromiumUse('Desktop Edge', 'msedge')
}

// The "browser" setting picks which browser projects exist, so a plain `npx playwright test` runs only those.
// With --project on the command line every project is defined and the flag chooses, so the flag always wins.
// Workers get every project too: they only run what the main process hands them.
const hasProjectFlag = process.argv.some((arg) => arg === '--project' || arg.startsWith('--project='))
function selectedBrowsers() {
  if (isWorker || hasProjectFlag) return Object.keys(BROWSER_PROJECTS)
  return settings.browser === 'all' ? ['chromium', 'firefox', 'webkit'] : [settings.browser]
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
    ...selectedBrowsers().map((name) => ({ name, use: BROWSER_PROJECTS[name], testIgnore: API_SPECS })),
    // No browser involved, so it runs whichever browser is selected
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
