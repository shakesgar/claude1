const path = require('path')
const { defineConfig, devices } = require('@playwright/test')
const { loadTestSettingsWithSources, isLocalURL, isWorker } = require('./config/testSettings')

// Run settings a person can edit without touching this file (see TESTING.md).
// Command-line flags such as --headed and environment variables such as SLOWMO take priority over them.
const { settings, provided } = loadTestSettingsWithSources(path.join(__dirname, 'testsettings.json'))

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

// The site under test. When it is on this machine Playwright starts the demo app on the port in the URL,
// so the app and the tests always agree. Anywhere else, the site must already be running in test mode.
const { baseURL } = settings
const target = new URL(baseURL)
const startApp = isLocalURL(baseURL)
const port = target.port || (target.protocol === 'https:' ? '443' : '80')
if (!startApp && !isWorker) {
  console.log(`testsettings: running against the existing site at ${baseURL}, no local app is started`)
}
const isCI = !!process.env.CI

// Retries come from the "retries" setting. Only when nobody set it (not in testsettings.json, no RETRIES
// variable) does CI fall back to 2, so one intermittent failure does not fail a build by default.
const retries = !provided.has('retries') && isCI ? 2 : settings.retries

// With more than one worker the fixtures give each worker its own copy of the app (see "workers" in
// TESTING.md). That is only possible on this machine, so a parallel run against another site gets a warning.
// The --workers (or -j) flag overrides the setting, so the warning has to look at it too.
function workersFromFlag() {
  const index = process.argv.findIndex((arg) => /^(--workers|-j)(=|$)/.test(arg))
  if (index === -1) return undefined
  const arg = process.argv[index]
  return arg.includes('=') ? arg.split('=')[1] : process.argv[index + 1]
}
const effectiveWorkers = workersFromFlag() ?? String(settings.workers)
if (effectiveWorkers !== '1' && !startApp && !isWorker) {
  console.warn(`testsettings: more than 1 worker against ${baseURL} is not safe; the workers share that site's data and will wipe each other's records`)
}

// API specs need no browser, so they run once in their own project
const API_SPECS = /api[\\/].*\.spec\.js$/

module.exports = defineConfig({
  testDir: './tests/specs',
  globalSetup: require.resolve('./tests/global-setup'),
  outputDir: 'test-results',

  // The app keeps one in-memory data set and every test resets it, so tests must not run at the
  // same time against the same server. The "workers" setting defaults to 1 for that reason.
  fullyParallel: false,
  workers: settings.workers,

  forbidOnly: isCI,
  retries,
  // On CI: list for the log, github for annotations on the run, html for the downloadable report,
  // and json for scripts/ci-summary.js, which writes the job summary.
  reporter: isCI
    ? [['list'], ['github'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]]
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

  webServer: !startApp
    ? undefined
    : {
        command: 'node server.js',
        url: `${baseURL}/login`,
        env: { NODE_ENV: 'test', PORT: port },
        reuseExistingServer: !isCI,
        timeout: 30_000
      }
})
