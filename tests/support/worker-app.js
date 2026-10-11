const { spawn } = require('child_process')
const net = require('net')
const path = require('path')
const { request } = require('@playwright/test')
const { STORAGE_STATE, USERS } = require('./env')

const ROOT = path.join(__dirname, '..', '..')
const ROLES = ['recruiter', 'admin']
const START_TIMEOUT = 15_000

// Logs in as each role through the API and saves the sessions to the given files,
// so tests can start already signed in. Sessions belong to the server they were made on.
async function saveLogins(baseURL, paths = STORAGE_STATE) {
  for (const role of ROLES) {
    const context = await request.newContext({ baseURL })
    const { email, password } = USERS[role]
    const login = await context.post('/api/auth/login', { data: { email, password } })
    if (!login.ok()) throw new Error(`Could not log in as ${role} at ${baseURL}: ${login.status()} ${await login.text()}`)
    await context.storageState({ path: paths[role] })
    await context.dispose()
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', reject)
    probe.listen(0, () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

async function waitUntilReady(url, child) {
  const deadline = Date.now() + START_TIMEOUT
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`The app for this worker exited with code ${child.exitCode} before it was ready`)
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`The app for this worker did not answer at ${url} within ${START_TIMEOUT / 1000} seconds`)
}

// Starts a private copy of the demo app for one worker, in test mode on a free port, and signs in
// both roles on it. Each worker then has its own in-memory data, so parallel tests cannot wipe or
// see each other's records. `sharedBaseURL` only supplies the protocol and host name.
async function startWorkerApp(sharedBaseURL, parallelIndex) {
  const port = await freePort()
  const target = new URL(sharedBaseURL)
  target.port = String(port)
  const baseURL = target.origin

  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port) },
    stdio: 'ignore'
  })
  const stop = () => {
    if (child.exitCode === null) child.kill()
  }
  // Covers a worker that is ended without running its fixture teardown
  process.once('exit', stop)

  try {
    await waitUntilReady(`${baseURL}/login`, child)
    const storageState = Object.fromEntries(
      ROLES.map((role) => [role, STORAGE_STATE[role].replace(/\.json$/, `-worker${parallelIndex}.json`)])
    )
    await saveLogins(baseURL, storageState)
    return { baseURL, storageState, stop }
  } catch (err) {
    stop()
    throw err
  }
}

module.exports = { saveLogins, startWorkerApp }
