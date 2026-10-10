# Testing

End-to-end and API tests for Recruit Demo CRM, written in JavaScript with [Playwright Test](https://playwright.dev). All test data is fake.

## Running the tests

```
npm install
npx playwright install      # first time only: downloads Chromium, Firefox and WebKit
npm test
```

Playwright starts the app itself in test mode on port 3000 and stops it afterwards. If something is already running on port 3000 it is reused, so stop any server you started with `npm start` first: tests need test mode for `POST /api/test/reset`, and the global setup fails with a clear message if it is missing.

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

To test an app that is already running elsewhere, set `BASE_URL`. Playwright then does not start a server, and the app at that address must be in test mode:

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
  "maximized": false
}
```

| Setting    | Type                      | Default | What it does                                                                                 |
|------------|---------------------------|---------|----------------------------------------------------------------------------------------------|
| `headless` | boolean                   | `true`  | `true` runs browsers with no visible window. `false` opens a window so you can watch the tests. |
| `slowMo`   | whole number, 0 or more   | `0`     | Pauses this many milliseconds after each browser action (click, fill, navigation). `0` is off. |
| `pageZoom` | whole number, 1 to 100    | `100`   | Shrinks every page to this percentage with CSS zoom. `100` is normal size.                    |
| `maximized` | boolean                  | `false` | `true` opens the Chromium window maximised, with the page filling it. Headed runs only.       |

The file is committed, and CI runs with the committed values. Keep the defaults shown above there; change them locally to watch or debug a run, and do not commit those changes.

Three settings can also be set for a single run with an environment variable, which takes priority over the file: `SLOWMO`, `PAGE_ZOOM` and `MAXIMIZED` (`true` or `false`). An empty variable is ignored. Playwright has no command-line flag for any of the three, so their order of priority is environment variable, then `testsettings.json`, then the default in `config/testSettings.js`.

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

### How the settings are checked

- If the file is missing, the defaults are used and one line says so.
- If the file is not valid JSON, is not a JSON object, contains a setting that does not exist (such as a misspelt `"headles"`), or has an invalid value (such as `"slowMo": -1` or `"slowMo": "1000"`), the run stops with an error that names the file, the setting and the value.
- If `SLOWMO`, `PAGE_ZOOM` or `MAXIMIZED` holds an invalid value, the run stops with an error that names the environment variable.

The API tests use no browser and ignore all four settings.

To add a setting, add one line to the `SETTINGS` table in `config/testSettings.js` (and to `ENV_OVERRIDES` if it should have an environment variable), use it in `playwright.config.js` or `tests/fixtures/index.js`, and add a row to the table above.

## Structure

```
testsettings.json           run settings: headless, slowMo, pageZoom, maximized (see above)
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
| `api`      | `specs/api/*.spec.js`, once, no browser |

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
- Traces are recorded on the first retry. Retries are on in CI only, so to get a trace locally run `npx playwright test --trace on` and open it from the report.
- `npx playwright test --debug -g "test title"` steps through one test.

## Continuous integration

`.github/workflows/playwright.yml` runs the full suite on every push and pull request to `main` or `master`. In CI the config retries failed tests twice, forbids `test.only`, and always starts a fresh server. The HTML report is uploaded as the `playwright-report` artifact; traces and screenshots are uploaded as `test-results` when a run fails.
