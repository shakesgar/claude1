const { test: base, expect } = require('@playwright/test')
const { STORAGE_STATE, NO_SESSION } = require('../support/env')
const { ApiClient } = require('../support/api-client')
const { LoginPage } = require('../pages/login-page')
const { CandidateListPage } = require('../pages/candidate-list-page')
const { CandidateFormPage } = require('../pages/candidate-form-page')
const { CandidateProfilePage } = require('../pages/candidate-profile-page')
const { JobsPage } = require('../pages/jobs-page')
const { PipelinePage } = require('../pages/pipeline-page')
const { NavBar } = require('../components/nav-bar')
const { startWorkerApp } = require('../support/worker-app')
const { loadTestSettings, assertResetAllowed, isLocalURL } = require('../../config/testSettings')

const settings = loadTestSettings()

const test = base.extend({
  // With more than one worker, each worker gets its own copy of the app with its own data, so tests
  // running at the same time cannot wipe or see each other's records. With one worker, or a site on
  // another machine, this is null and every test uses the shared site at the baseURL setting.
  workerApp: [async ({}, use, workerInfo) => {
    if (workerInfo.config.workers === 1 || !isLocalURL(settings.baseURL)) {
      await use(null)
      return
    }
    const app = await startWorkerApp(settings.baseURL, workerInfo.parallelIndex)
    await use(app)
    app.stop()
  }, { scope: 'worker' }],

  baseURL: async ({ workerApp, baseURL }, use) => {
    await use(workerApp ? workerApp.baseURL : baseURL)
  },

  // Saved sessions for this worker's site, by role
  sessions: async ({ workerApp }, use) => {
    await use(workerApp ? workerApp.storageState : STORAGE_STATE)
  },

  // Applies the pageZoom setting to every page and popup, on every navigation.
  // Nothing is injected at 100, so default runs are untouched.
  context: async ({ context }, use) => {
    if (settings.pageZoom !== 100) {
      await context.addInitScript((zoom) => {
        const apply = () => {
          if (document.documentElement) document.documentElement.style.zoom = String(zoom)
        }
        apply()
        document.addEventListener('DOMContentLoaded', apply)
      }, settings.pageZoom / 100)
    }
    await use(context)
  },

  // Says once per worker when the maximized setting cannot be applied to this browser
  maximizedSupport: [async ({ browserName }, use) => {
    if (settings.maximized && !settings.headless && browserName !== 'chromium') {
      console.warn(`testsettings: "maximized" is only supported in Chromium, ${browserName} opens at its normal size`)
    }
    await use()
  }, { scope: 'worker', auto: true }],

  // Who the test is signed in as: 'recruiter' (default), 'admin' or 'anonymous'.
  // Change it for a file or describe block with test.use({ role: 'admin' }).
  role: ['recruiter', { option: true }],

  // Applies the saved session for the role to both `page` and `request`
  storageState: async ({ role, sessions }, use) => {
    await use(role === 'anonymous' ? NO_SESSION : sessions[role])
  },

  // Restores the seed data before every test, so tests never depend on each other
  resetData: [async ({ request, baseURL }, use) => {
    assertResetAllowed(baseURL, settings.allowRemoteReset)
    const response = await request.post('/api/test/reset')
    expect(response.ok(), 'POST /api/test/reset failed: is the app running in test mode?').toBeTruthy()
    await use()
  }, { auto: true }],

  // Extra API sessions for tests that need a second role alongside the main one
  adminRequest: async ({ playwright, baseURL, sessions }, use) => {
    const context = await playwright.request.newContext({ baseURL, storageState: sessions.admin })
    await use(context)
    await context.dispose()
  },
  anonymousRequest: async ({ playwright, baseURL }, use) => {
    const context = await playwright.request.newContext({ baseURL, storageState: NO_SESSION })
    await use(context)
    await context.dispose()
  },

  // Test-data helper that calls the API as the current role
  api: async ({ request }, use) => {
    await use(new ApiClient(request))
  },

  // Page objects and components
  navBar: async ({ page }, use) => use(new NavBar(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  candidateListPage: async ({ page }, use) => use(new CandidateListPage(page)),
  candidateFormPage: async ({ page }, use) => use(new CandidateFormPage(page)),
  candidateProfilePage: async ({ page }, use) => use(new CandidateProfilePage(page)),
  jobsPage: async ({ page }, use) => use(new JobsPage(page)),
  pipelinePage: async ({ page }, use) => use(new PipelinePage(page))
})

module.exports = { test, expect }
