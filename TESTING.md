# Testing

End-to-end and API tests for Recruit Demo CRM, written in JavaScript with [Playwright Test](https://playwright.dev). All test data is fake.

## Running the tests

```
npm install
npx playwright install      # first time only: downloads Chromium, Firefox and WebKit
npm test
```

Playwright starts the app itself in test mode on port 3000 (the port in the `baseURL` setting) and stops it afterwards. If something is already running on that port it is reused, so stop any server you started with `npm start` first: tests need test mode for `POST /api/test/reset`, and the global setup fails with a clear message if it is missing.

| Command               | What it does                                             |
|-----------------------|----------------------------------------------------------|
| `npm test`            | Full suite: UI tests on three browsers, plus API tests   |
| `npm run test:smoke`  | Only tests tagged `@smoke`                               |
| `npm run test:headed` | Full suite with visible browser windows                  |
| `npm run test:ui`     | Playwright's interactive UI mode                         |
| `npm run report`      | Opens the HTML report from the last run                  |

Useful variations:

```
npx playwright test --grep @regression          # by tag
npx playwright test --project=chromium          # one browser
npx playwright test --project=api               # API tests only
npx playwright test intake-form                 # one spec file
npx playwright test -g "validates the email"    # by test title
npx playwright test --debug                     # step through with the inspector
```

To run on another port or against a site that is already running elsewhere, change `baseURL` in `testsettings.json` or set `BASE_URL` for one run (see [baseURL](#baseurl)):

```
BASE_URL=http://localhost:4000 npx playwright test          # macOS/Linux
$env:BASE_URL='http://localhost:4000'; npx playwright test  # PowerShell
```

## Test settings

`testsettings.json` in the project root controls how Playwright runs, without editing `playwright.config.js`:

```json
{
  "headless": true,
  "slowMo": 0,
  "pageZoom": 100,
  "maximized": false,
  "browser": "all",
  "retries": 0,
  "baseURL": "http://localhost:3000",
  "allowRemoteReset": false
}
```

| Setting    | Type                      | Default | What it does                                                                                 |
|------------|---------------------------|---------|----------------------------------------------------------------------------------------------|
| `headless` | boolean                   | `true`  | `true` runs browsers with no visible window. `false` opens a window so you can watch the tests. |
| `slowMo`   | whole number, 0 or more   | `0`     | Pauses this many milliseconds after each browser action (click, fill, navigation). `0` is off. |
| `pageZoom` | whole number, 1 to 100    | `100`   | Shrinks every page to this percentage with CSS zoom. `100` is normal size.                    |
| `maximized` | boolean                  | `false` | `true` opens the Chromium window maximised, with the page filling it. Headed runs only.       |
| `browser`  | one of `chromium`, `firefox`, `webkit`, `chrome`, `msedge`, `all` | `all` | Which browser the UI tests run in. `all` runs Chromium, Firefox and WebKit. |
| `retries`  | whole number, 0 to 5      | `0`     | How many times a failed test is run again before it counts as failed.                         |
| `baseURL`  | full `http://` or `https://` URL | `http://localhost:3000` | The site the tests run against.                                     |
| `allowRemoteReset` | boolean           | `false` | `true` lets the tests wipe the data of a site that is not on this machine.                    |

The file is committed, and CI runs with the committed values. Keep the defaults shown above there; change them locally to watch or debug a run, and do not commit those changes.

Six settings can also be set for a single run with an environment variable, which takes priority over the file: `SLOWMO`, `PAGE_ZOOM`, `MAXIMIZED` (`true` or `false`), `BROWSER`, `RETRIES` and `BASE_URL`. An empty variable is ignored. For most settings the order of priority is environment variable, then `testsettings.json`, then the default in `config/testSettings.js`; Playwright has no command-line flag for them. `browser` and `retries` also have a command-line flag, described below.

### headless

When the same thing is set in more than one place, the order of priority is:

1. **Command-line flags.** `--headed`, `--ui` and `--debug` show the browser even when the file says `"headless": true`.
2. **`testsettings.json`.**
3. **The default** in `config/testSettings.js`.

Playwright has no `--headless` flag, so when the file says `false` the only way back to headless is to edit the file.

The GitHub Actions runner has no display, so a headed run fails there. That is why the committed file must say `true`.

### slowMo

`slowMo` is for debugging and demos: together with `"headless": false` it makes a test slow enough to follow by eye. Leave it at `0` for normal and CI runs. Every action waits the full delay, so `1000` turns a 2-second test into a 6-second one, and a test with many actions can pass the 30-second test timeout.

To slow down a single run without editing the file, set the `SLOWMO` environment variable:

```
SLOWMO=1000 npx playwright test smoke --project=chromium          # macOS/Linux
$env:SLOWMO='1000'; npx playwright test smoke --project=chromium  # PowerShell
```

In PowerShell the variable stays set for the rest of the session; clear it with `Remove-Item Env:SLOWMO`.

The order of priority is:

1. **The `SLOWMO` environment variable.** `SLOWMO=0` turns the delay off even when the file sets one. An empty value is ignored.
2. **`testsettings.json`.**
3. **The default** in `config/testSettings.js`.

Playwright has no command-line flag for this.

### pageZoom

`pageZoom` makes every page smaller, so more of it fits in the window: `50` draws the page at half size. It works in Chromium, Firefox and WebKit, in headed and headless runs.

Playwright has no page zoom of its own. The shared fixtures in `tests/fixtures/index.js` add a script to every browser context that sets CSS `zoom` on the `<html>` element, so it applies to every page, popup and navigation without any change to tests or page objects. At `100` nothing is injected and runs behave exactly as they would without the setting.

Limits:

- CSS zoom is not the same as the browser's own zoom (Ctrl and minus). The viewport and media queries do not change, so the layout does not reflow as it would for a user who zooms out; the page is simply drawn smaller.
- Tests that check sizes or positions in pixels would see scaled values.
- It only applies to pages created through the fixtures, which is every test in this framework.

```
PAGE_ZOOM=50 npx playwright test smoke --project=chromium          # macOS/Linux
$env:PAGE_ZOOM='50'; npx playwright test smoke --project=chromium  # PowerShell
```

### maximized

With `"maximized": true` and `"headless": false`, Chromium starts with `--start-maximized` and the viewport is set to `null`, so the page is as large as the window instead of the usual 1280×720. This replaces the viewport from the `Desktop Chrome` device descriptor.

Limits:

- **Chromium only.** Firefox and WebKit have no equivalent, so they open at their normal size and print one warning per worker.
- **Headed only.** When `headless` is `true` the setting does nothing and one notice says so. "Headed" here means `"headless": false` in the file: running with `--headed` while the file says `true` shows the browser but does not maximise it.
- The page size then depends on your screen, so layout can differ from a normal run. Use it for watching and demos, not for results you compare between machines.

```
MAXIMIZED=true npx playwright test smoke --project=chromium          # macOS/Linux
$env:MAXIMIZED='true'; npx playwright test smoke --project=chromium  # PowerShell
```

### browser

`browser` chooses which browser projects a plain `npx playwright test` (or `npm test`) runs.

| Value      | Runs in                                                                 |
|------------|-------------------------------------------------------------------------|
| `all`      | Chromium, Firefox and WebKit, the three engines Playwright downloads    |
| `chromium` | Playwright's Chromium                                                   |
| `firefox`  | Playwright's Firefox                                                    |
| `webkit`   | Playwright's WebKit, the engine behind Safari                           |
| `chrome`   | Google Chrome as installed on this machine                              |
| `msedge`   | Microsoft Edge as installed on this machine                             |

`all` does not include `chrome` or `msedge`.

`chromium`, `chrome` and `msedge` share one engine but are different programs. `chromium` is the open-source build that `npx playwright install` downloads; its version is fixed by the Playwright version, so it is the same on every machine and in CI. `chrome` and `msedge` are the branded browsers your users have, at whatever version is installed here, so results can change when the browser updates itself. They use the same viewport and settings as the `chromium` project.

Installing browsers:

- `chromium`, `firefox` and `webkit` need `npx playwright install` once after `npm install`.
- `chrome` and `msedge` must already be installed on the machine. If one is missing, every test fails at launch with Playwright's message, for example `Chromium distribution 'chrome' is not found at C:\...\chrome.exe`, followed by `Run "npx playwright install chrome"`. That command installs it; so does a normal install of the browser.

The API tests use no browser, so the `api` project runs whichever browser is selected.

The order of priority is:

1. **The `--project` command-line flag.** `npx playwright test --project=firefox` runs Firefox whatever the variable and the file say. All five browser projects and `api` can be named, and the flag can be repeated.
2. **The `BROWSER` environment variable.**
3. **`testsettings.json`.**
4. **The default**, `all`, in `config/testSettings.js`.

```
BROWSER=msedge npx playwright test smoke          # macOS/Linux
$env:BROWSER='msedge'; npx playwright test smoke  # PowerShell
```

Some Linux, macOS and WSL setups already set `BROWSER` to the program that opens links. If yours holds something other than the six values above, the run stops with an error naming the variable; unset it for the test run (`BROWSER= npx playwright test`).

The other settings work with every choice. `maximized` applies to `chromium`, `chrome` and `msedge`, and prints its warning for `firefox` and `webkit`.

Keep `"browser": "all"` in the committed file: CI runs with it, so committing a single browser would cut what CI covers.

### retries

`retries` is how many times Playwright runs a failed test again. With `0` a test that fails once is reported as failed. With `1` or more, a test that fails and then passes is reported as **flaky**, and the run still succeeds.

Valid values are whole numbers from `0` to `5`. The default is `0`.

The order of priority is:

1. **The `--retries` command-line flag**, for example `npx playwright test --retries=2`.
2. **The `RETRIES` environment variable.**
3. **`testsettings.json`.**
4. **The default**, `0`. The one exception: when the `CI` environment variable is set and `retries` was not provided at all (no `retries` line in the file, or no file, and no `RETRIES` variable), the default is `2`.

A `retries` line in the file counts as provided even when it says `0`, so the committed `"retries": 0` would switch retries off in CI. The GitHub Actions workflow therefore sets `RETRIES: 2` itself; change CI's retries there, not in the file.

```
RETRIES=1 npx playwright test          # macOS/Linux
$env:RETRIES='1'; npx playwright test  # PowerShell
```

**Retries can hide real bugs.** A test that passes on its second attempt has still failed once, and the cause may be a genuine intermittent fault in the app, such as a race condition, as easily as a weakness in the test. Treat every flaky test as a failure to investigate and fix. Retries are there to keep a build usable while you do that, not to make the problem go away. To make flaky tests fail the run, add `--fail-on-flaky-tests`.

#### Finding flaky tests

- **Console:** the summary at the end of a run has its own count, for example `1 flaky`, listed with the test's name and the error from the failed attempt. During the run, the list shows the failed attempt and then the same test again marked `(retry #1)`.
- **HTML report:** `npm run report`, then use the **Flaky** filter at the top. Opening a flaky test shows one tab per attempt, with the error and screenshot from the failed one and the trace from the retry.
- **GitHub Actions:** the run summary has a "Playwright Run Summary" notice that lists flaky tests, and the `playwright-report` artifact holds the HTML report. A run with only flaky tests is green, so look at the notice, not just the tick.

Traces are recorded on the first retry only (`trace: 'on-first-retry'`). With `retries` at `0` there is no retry, so a failed test has a screenshot but no trace; see [When a test fails](#when-a-test-fails).

### baseURL

`baseURL` is the site the tests run against. Every page object, fixture, API helper and the global setup take the address from it; none contains an address of its own.

Valid values are full URLs that start with `http://` or `https://`, such as `http://localhost:3000` or `https://crm-test.example.com`. A trailing slash is removed. `localhost:3000` (no protocol) and `ftp://x` are rejected. Do not add a path: the tests open pages such as `/login` from the root of the site.

What happens depends on the host:

| `baseURL` host               | Web server                                                                 |
|------------------------------|----------------------------------------------------------------------------|
| `localhost` or `127.0.0.1`   | Playwright starts the demo app in test mode on the port in the URL (it sets `PORT` for the app), and stops it afterwards. Outside CI, an app already running at that address is reused. |
| anything else                | Nothing is started. One line says the tests will run against the existing site, which must already be running in test mode. |

The demo app only serves `http`, so use `http://` for local addresses.

The order of priority is:

1. **The `BASE_URL` environment variable.**
2. **`testsettings.json`.**
3. **The default**, `http://localhost:3000`, in `config/testSettings.js`.

If the site cannot be reached, the run stops before any test with `Could not reach <baseURL>` and the reason.

### allowRemoteReset

The suite calls `POST /api/test/reset` before every test and once at the start of the run. **That call replaces all of the site's data with the seed data.** On your own machine that is what you want. On a shared environment it would wipe other people's work.

So when the `baseURL` host is not `localhost` or `127.0.0.1`, the reset step refuses to run and the whole run stops before anything is sent:

```
Refusing to reset the data at https://crm-test.example.com: POST /api/test/reset wipes the site's data and this is not localhost or 127.0.0.1. If that site is yours to wipe, set "allowRemoteReset": true in testsettings.json.
```

Set `"allowRemoteReset": true` only for a site whose data the tests are allowed to wipe. It has no environment variable on purpose, and it should stay `false` in the committed file. It has no effect for local addresses.

### How the settings are checked

- If the file is missing, the defaults are used and one line says so.
- If the file is not valid JSON, is not a JSON object, contains a setting that does not exist (such as a misspelt `"headles"`), or has an invalid value (such as `"slowMo": -1` or `"slowMo": "1000"`), the run stops with an error that names the file, the setting and the value.
- If `SLOWMO`, `PAGE_ZOOM`, `MAXIMIZED`, `BROWSER`, `RETRIES` or `BASE_URL` holds an invalid value, the run stops with an error that names the environment variable.

The API tests use no browser, so of these settings only `retries`, `baseURL` and `allowRemoteReset` affect them.

To add a setting, add one line to the `SETTINGS` table in `config/testSettings.js` (and to `ENV_OVERRIDES` if it should have an environment variable), use it in `playwright.config.js` or `tests/fixtures/index.js`, and add a row to the table above.

## Structure

```
testsettings.json           run settings: headless, browser, baseURL and others (see above)
config/testSettings.js      loads and validates testsettings.json
playwright.config.js        projects, web server, retries, reporters
tests/
  global-setup.js           checks test mode, logs in as each role, saves the sessions
  fixtures/index.js         the `test` and `expect` every spec imports
  pages/                    page objects, one class per page
  components/               reusable pieces of UI: nav bar, table, toast, confirm dialog
  data/
    builders.js             Faker-based builders for candidates, roles, jobs and notes
    files.js                in-memory files for upload tests
    constants.js            skills, stages, option labels and seed counts
  support/
    env.js                  seeded users and saved-session paths
    api-client.js           creates test data through the REST API
  specs/
    smoke.spec.js           @smoke: login, list, create a candidate, logout
    auth.spec.js            invalid login, roles, session persistence
    candidate-list.spec.js  search, filter, sort, pagination
    intake-form.spec.js     every validation rule, conditional fields, drafts, submit
    candidate-profile.spec.js   notes and CV uploads
    pipeline.spec.js        stage changes and status history
    mixed.spec.js           data created by API, verified in the UI
    api/                    API-only tests (no browser)
  .auth/                    saved sessions, generated, not committed
```

### Projects

| Project    | Runs                                   |
|------------|----------------------------------------|
| `chromium` | every spec outside `specs/api/`        |
| `firefox`  | the same specs                         |
| `webkit`   | the same specs                         |
| `chrome`   | the same specs, in installed Google Chrome; only when selected |
| `msedge`   | the same specs, in installed Microsoft Edge; only when selected |
| `api`      | `specs/api/*.spec.js`, once, no browser |

Which browser projects run is set by `browser` in `testsettings.json` (see [browser](#browser)); by default it is the first three.

### Why tests run one at a time

The app holds a single in-memory data set, and every test resets it. Two tests running at once against one server would wipe each other's data, so the config sets `workers: 1`. The suite still finishes in a few minutes.

## Fixtures

Specs import `test` and `expect` from `tests/fixtures`, never from `@playwright/test` directly:

```js
const { test, expect } = require('../fixtures')
```

| Fixture                | What it gives you                                                              |
|------------------------|--------------------------------------------------------------------------------|
| `role` (option)        | Who the test is signed in as: `'recruiter'` (default), `'admin'` or `'anonymous'` |
| `resetData` (automatic) | Calls `POST /api/test/reset` before every test; you never request it           |
| `page`, `request`      | Playwright's own fixtures, already signed in as the current role               |
| `api`                  | `ApiClient` for creating data as the current role                              |
| `adminRequest`         | A second API session signed in as the admin                                    |
| `anonymousRequest`     | An API session with no login                                                   |
| `loginPage`, `candidateListPage`, `candidateFormPage`, `candidateProfilePage`, `jobsPage`, `pipelinePage` | Page objects for `page` |
| `navBar`               | The header component for `page`                                                |

Change the role for a file or a `describe` block:

```js
test.describe('as an admin', () => {
  test.use({ role: 'admin' })

  test('can open the Users page', async ({ page }) => { /* ... */ })
})
```

Sessions come from `storageState` files that the global setup creates by logging in through the API, so tests do not repeat the login form.

**Logging out ends the saved session on the server.** A test that logs out must use `role: 'anonymous'` and log in through the UI first, as the smoke logout test does. Otherwise every later test would start signed out.

## Conventions

### Locators

Use, in this order:

1. `getByRole` for buttons, links, headings, checkboxes, radios, dialogs and navigation
2. `getByLabel` for form fields
3. `getByTestId` for content with no role or label, such as error messages, table cells and status badges

Do not use CSS or XPath selectors. If an element cannot be reached with the three above, add a `data-testid` to the app. The app's naming scheme is described in `README.md`.

Two things to watch for:

- Names match by substring unless you pass `exact: true`. "Move Sam Sample" also matches "Re**move Sam Sample** from…", so the pipeline page object uses `exact`.
- `getByLabel` also matches elements named by `aria-labelledby`, including the confirmation dialog. Where a field and a dialog share a name, use `getByRole('combobox', { name })` instead.

### Page objects

- One class per page in `tests/pages`, taking `page` in the constructor.
- Locators are defined once in the constructor as properties. Locators that need an argument are methods (`error('email')`, `note(text)`).
- Methods perform actions (`search`, `fillPersonal`, `moveTo`). Assertions stay in the specs, apart from waits that make an action reliable and a few named `expect...` helpers.
- `goto()` waits until the page is ready for input, for example until the table has loaded. Specs never need `waitForTimeout`.
- Shared UI goes in `tests/components` and is composed into page objects (`this.toast = new Toast(page)`).

### Tests

- Each test sets up what it needs and does not rely on another test. The seed data is restored before every test, so seeded records such as candidate 1 can be used and even changed freely.
- Create prerequisites through the `api` fixture, not the UI, unless the UI flow is what the test is about.
- Build data with the builders and override only what the test cares about:

  ```js
  const candidate = buildCandidate({ rightToWork: 'visa', visaType: 'Skilled Worker', visaExpiry: isoDate(400) })
  ```

- Use `isoDate(offsetDays)` for dates, never fixed dates near today.
- Use web-first assertions (`await expect(locator).toHaveText(...)`), which retry until they pass.
- Tag every `describe` with `@smoke` or `@regression`: `test.describe('Jobs', { tag: '@regression' }, () => { ... })`.
- Title tests as a statement of behaviour: "rejects a wrong password", not "test login 2".

## Adding a page object and a test

This example adds coverage for the Users page.

**1. Create the page object** in `tests/pages/users-page.js`:

```js
const { Table } = require('../components/table')

class UsersPage {
  constructor(page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'Users', level: 1 })
    this.table = new Table(page.getByTestId('users-table'), 'user-row')
  }

  async goto() {
    await this.page.goto('/users')
  }

  emails() {
    return this.table.cellTexts('user-email')
  }
}

module.exports = { UsersPage }
```

**2. Register it as a fixture** in `tests/fixtures/index.js`:

```js
const { UsersPage } = require('../pages/users-page')

// inside base.extend({ ... })
usersPage: async ({ page }, use) => use(new UsersPage(page)),
```

**3. Write the spec** in `tests/specs/users.spec.js`:

```js
const { test, expect } = require('../fixtures')
const { USERS } = require('../support/env')

test.describe('Users page', { tag: '@regression' }, () => {
  test.use({ role: 'admin' })

  test('lists the seeded accounts', async ({ usersPage }) => {
    await usersPage.goto()

    await expect(usersPage.heading).toBeVisible()
    expect(await usersPage.emails()).toContain(USERS.recruiter.email)
  })
})
```

**4. Run it:**

```
npx playwright test users --project=chromium
```

API-only tests go in `tests/specs/api/` with a name ending `.api.spec.js`; they run in the `api` project and use the `request` fixture.

## When a test fails

- `npm run report` opens the HTML report, with a screenshot for every failed test.
- Traces are recorded on the first retry. Local runs have `retries` at `0` by default, so to get a trace locally run `npx playwright test --trace on` (or `--retries=1`) and open it from the report.
- `npx playwright test --debug -g "test title"` steps through one test.

## Continuous integration

`.github/workflows/playwright.yml` runs the full suite on every push and pull request to `main` or `master`. The workflow sets `RETRIES: 2`, so failed tests are retried twice (see [retries](#retries)). In CI the config also forbids `test.only` and always starts a fresh server. The HTML report is uploaded as the `playwright-report` artifact; traces and screenshots are uploaded as `test-results` when a run fails.
