const { request } = require('@playwright/test')
const { STORAGE_STATE, USERS } = require('./support/env')
const { loadTestSettings, assertResetAllowed } = require('../config/testSettings')

// Runs once before all tests: checks the app is in test mode, then logs in as each
// role through the API and saves the session so tests can start already signed in.
module.exports = async config => {
  const { baseURL } = config.projects[0].use

  // Stops the whole run before anything is sent to a site that must not be wiped
  assertResetAllowed(baseURL, loadTestSettings().allowRemoteReset)

  const anonymous = await request.newContext({ baseURL })
  let reset
  try {
    reset = await anonymous.post('/api/test/reset')
  } catch (err) {
    const cause = err.message.split('\n')[0]
    throw new Error(`Could not reach ${baseURL} (${cause}). Check "baseURL" in testsettings.json and that the site is running.`)
  } finally {
    await anonymous.dispose()
  }
  if (!reset.ok()) {
    throw new Error(
      `POST ${baseURL}/api/test/reset returned ${reset.status()}. ` +
      'The app must run in test mode: stop any server already on that address, or start it with "npm run start:test".'
    )
  }

  for (const role of ['recruiter', 'admin']) {
    const context = await request.newContext({ baseURL })
    const { email, password } = USERS[role]
    const login = await context.post('/api/auth/login', { data: { email, password } })
    if (!login.ok()) throw new Error(`Could not log in as ${role}: ${login.status()} ${await login.text()}`)
    await context.storageState({ path: STORAGE_STATE[role] })
    await context.dispose()
  }
}
