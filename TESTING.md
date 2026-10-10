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

## Structure

```
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
