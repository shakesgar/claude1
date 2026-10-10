const fs = require('fs')
const path = require('path')

const DEFAULT_PATH = path.join(__dirname, '..', 'testsettings.json')

// 'all' means the three bundled engines; chrome and msedge are the browsers installed on the machine
const BROWSERS = ['chromium', 'firefox', 'webkit', 'chrome', 'msedge', 'all']

// One entry per setting: its default, a check for valid values, and how to describe them in an error.
// To add a setting, add a line here, use it in playwright.config.js and describe it in TESTING.md.
const SETTINGS = {
  headless: { default: true, isValid: (value) => typeof value === 'boolean', expects: 'a boolean' },
  slowMo: { default: 0, isValid: (value) => Number.isInteger(value) && value >= 0, expects: 'a whole number of 0 or more' },
  pageZoom: { default: 100, isValid: (value) => Number.isInteger(value) && value >= 1 && value <= 100, expects: 'a whole number from 1 to 100' },
  maximized: { default: false, isValid: (value) => typeof value === 'boolean', expects: 'a boolean' },
  browser: { default: 'all', isValid: (value) => BROWSERS.includes(value), expects: `one of ${BROWSERS.join(', ')}` }
}

const parseWholeNumber = (text) => (/^\d+$/.test(text.trim()) ? Number(text) : NaN)
// Anything other than true or false is passed through so that validation rejects it
const parseBoolean = (text) => ({ true: true, false: false }[text.trim()] ?? text)

// Environment variables that override a setting for a single run
const ENV_OVERRIDES = {
  slowMo: { variable: 'SLOWMO', parse: parseWholeNumber },
  pageZoom: { variable: 'PAGE_ZOOM', parse: parseWholeNumber },
  maximized: { variable: 'MAXIMIZED', parse: parseBoolean },
  browser: { variable: 'BROWSER', parse: (text) => text.trim() }
}

const DEFAULTS = Object.fromEntries(Object.entries(SETTINGS).map(([name, setting]) => [name, setting.default]))

// Playwright loads the config in the main process and again in every worker
const isWorker = process.env.TEST_WORKER_INDEX !== undefined

// Returns the defaults, overridden by the settings file, overridden by environment variables.
// A missing file is fine; a file that cannot be used stops the run with an error naming the file.
function loadTestSettings(filePath = DEFAULT_PATH) {
  return { ...readSettingsFile(filePath), ...readEnvOverrides() }
}

function readEnvOverrides() {
  const overrides = {}
  for (const [name, { variable, parse }] of Object.entries(ENV_OVERRIDES)) {
    const text = process.env[variable]
    if (text === undefined || text.trim() === '') continue
    const value = parse(text)
    if (!SETTINGS[name].isValid(value)) {
      throw new Error(`${variable} environment variable: must be ${SETTINGS[name].expects}, but got ${JSON.stringify(text)}`)
    }
    overrides[name] = value
  }
  return overrides
}

function readSettingsFile(filePath) {
  const file = path.basename(filePath)

  let text
  try {
    text = fs.readFileSync(filePath, 'utf8')
  } catch (err) {
    if (err.code !== 'ENOENT') throw new Error(`${file}: could not be read (${err.message})`)
    if (!isWorker) console.log(`${file} not found, using defaults: ${JSON.stringify(DEFAULTS)}`)
    return { ...DEFAULTS }
  }

  let values
  try {
    values = JSON.parse(text)
  } catch (err) {
    throw new Error(`${file}: not valid JSON (${err.message.replace(/\s+/g, ' ')})`)
  }
  if (values === null || typeof values !== 'object' || Array.isArray(values)) {
    throw new Error(`${file}: must contain a JSON object such as ${JSON.stringify(DEFAULTS)}`)
  }

  for (const [name, value] of Object.entries(values)) {
    const setting = SETTINGS[name]
    if (!setting) {
      throw new Error(`${file}: unknown setting "${name}". Known settings: ${Object.keys(SETTINGS).join(', ')}`)
    }
    if (!setting.isValid(value)) {
      throw new Error(`${file}: "${name}" must be ${setting.expects}, but got ${JSON.stringify(value)}`)
    }
  }

  return { ...DEFAULTS, ...values }
}

module.exports = { loadTestSettings, DEFAULTS, isWorker }
