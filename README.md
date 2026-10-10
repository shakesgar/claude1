# Recruit Demo CRM

A demo recruitment agency CRM for practising test automation. Every name, company, email address and phone number in it is made up. Do not put real personal data into it.

- Backend: Node.js and Express, session-based login
- Front end: plain HTML, CSS and vanilla JavaScript (no framework, no build step)
- Data: held in memory and loaded from `data/seed.json`; restarting the server restores the seed

See [FEATURES.md](FEATURES.md) for the pages, API routes and validation rules.

## Run it

Requires Node.js 18 or later.

```
npm install
npm start
```

Open http://localhost:3000. Set the `PORT` environment variable to use a different port.

### Test mode

Test mode enables `POST /api/test/reset`, which restores the seed data without a restart. Outside test mode that route returns 404.

```
npm run start:test
```

This is the same as starting with `NODE_ENV=test` (`NODE_ENV=test npm start` on macOS/Linux, `$env:NODE_ENV='test'; npm start` in PowerShell).

```
curl -X POST http://localhost:3000/api/test/reset
```

The reset needs no login and leaves existing sessions signed in.

## Seeded users

All users share the password `Password123!`.

| Name            | Email                    | Role      | Notes                                         |
|-----------------|--------------------------|-----------|-----------------------------------------------|
| Alex Admin      | `admin@example.com`      | admin     | Can open the Users page and delete records    |
| Riley Recruiter | `recruiter@example.com`  | recruiter | Author of most seeded notes                   |
| Robin Recruiter | `recruiter2@example.com` | recruiter | Second recruiter, for note-ownership tests    |
| Dana Disabled   | `disabled@example.com`   | recruiter | Disabled account: login is refused with a 403 |

## Seed data

- 32 candidates (ids 1–32): 20 Active, 4 Interviewing, 3 Placed, 3 Unavailable and 2 Drafts (ids 31 and 32)
- 8 jobs (ids 1–8): 5 Open, 1 On Hold, 1 Closed, 1 Draft
- 25 candidate-job pairings spread across all six pipeline stages
- 8 notes on candidates 1, 2, 3, 4, 5 and 10

Emails use `example.com` and phone numbers use the `07700 900xxx` range reserved for fiction. The seed is static, so ids and counts are the same after every restart or reset.

## Writing tests against it

- Interactive elements and key content carry `data-testid` attributes. Repeated items share one id (`candidate-row`, `note-item`, `pipeline-card`) and carry the record id in a data attribute such as `data-candidate-id`.
- Form fields follow `input-<field>` and `error-<field>`, for example `input-email` and `error-email`. Employment rows are indexed: `input-employmentHistory-0-company`.
- Confirmations use one in-page dialog: `confirm-dialog`, `confirm-message`, `confirm-accept`, `confirm-cancel`.
- Success and failure messages appear in `flash-message`; its `data-flash-type` is `success` or `error`.
- Tables set `aria-busy="true"` while loading, which gives tests something to wait on.
- The candidate list keeps its search, filters, sort and page in the URL query string.

## Automated tests

The repo includes a Playwright suite (UI tests on Chromium, Firefox and WebKit, plus API tests). See [TESTING.md](TESTING.md).

```
npx playwright install   # first time only
npm test
```

## Project layout

```
tests/               Playwright tests, page objects and fixtures
playwright.config.js Playwright configuration
server.js            entry point
src/                 Express app, in-memory store and API routes
views/               HTML pages
public/css, js       styles and page scripts
public/js/validators.js   validation rules, shared by the browser and the server
data/seed.json       seed data
```

## Limits

This is a teaching app, not a production one: passwords are stored in plain text, there is no CSRF protection, and all data (including uploaded CVs) is lost on restart.
