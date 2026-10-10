const { request } = require('@playwright/test')
const { STORAGE_STATE, USERS } = require('./support/env')

// Runs once before all tests: checks the app is in test mode, then logs in as each
// role through the API and saves the session so tests can start already signed in.
module.exports = async config => {
  const { baseURL } = config.projects[0].use

  const anonymous = await request.newContext({ baseURL })
  const reset = await anonymous.post('/api/test/reset')
  await anonymous.dispose()
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
