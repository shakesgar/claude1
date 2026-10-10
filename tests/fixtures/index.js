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

const test = base.extend({
  // Who the test is signed in as: 'recruiter' (default), 'admin' or 'anonymous'.
  // Change it for a file or describe block with test.use({ role: 'admin' }).
  role: ['recruiter', { option: true }],

  // Applies the saved session for the role to both `page` and `request`
  storageState: async ({ role }, use) => {
    await use(role === 'anonymous' ? NO_SESSION : STORAGE_STATE[role])
  },

  // Restores the seed data before every test, so tests never depend on each other
  resetData: [async ({ request }, use) => {
    const response = await request.post('/api/test/reset')
    expect(response.ok(), 'POST /api/test/reset failed: is the app running in test mode?').toBeTruthy()
    await use()
  }, { auto: true }],

  // Extra API sessions for tests that need a second role alongside the main one
  adminRequest: async ({ playwright, baseURL }, use) => {
    const context = await playwright.request.newContext({ baseURL, storageState: STORAGE_STATE.admin })
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
