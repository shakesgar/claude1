# Features

## Pages

All pages except `/login` require a session; signed-out visitors are redirected to `/login?next=<path>`.

| Path                    | Page                | What it does                                                                                           |
|-------------------------|---------------------|--------------------------------------------------------------------------------------------------------|
| `/login`                | Login               | Email and password login, with field errors and an invalid-login message                               |
| `/candidates`           | Candidates list     | Search by name, filter by status and skill, sortable columns, 10 per page                              |
| `/candidates/new`       | Intake form         | 5 steps with Next/Back, progress indicator, per-step validation, save as draft (`?draft=<id>` resumes) |
| `/candidates/:id`       | Candidate profile   | Details, employment, CV upload, job assignments, notes, status change and status history               |
| `/jobs`                 | Jobs list           | Search by title or client, filter by status                                                            |
| `/jobs/new`             | Create job          | Job form                                                                                               |
| `/jobs/:id/edit`        | Edit job            | Job form, pre-filled                                                                                   |
| `/jobs/:id`             | Job detail          | Details, assigned candidates, assign a candidate                                                       |
| `/pipeline`             | Pipeline board      | One column per stage, filter by job (`?jobId=<id>`), move or remove with confirmation                  |
| `/users`                | Users (admin only)  | Lists users; recruiters get a 403 "Access denied" page and no nav link                                 |
| anything else           | Not found           | 404 page                                                                                               |

## Roles

| Action                                   | Recruiter | Admin |
|------------------------------------------|-----------|-------|
| Candidates, jobs, pipeline, notes, CVs   | yes       | yes   |
| Edit or delete another user's note       | no (403)  | yes   |
| Delete a candidate or a job              | no (403)  | yes   |
| Users page and `GET /api/users`          | no (403)  | yes   |

## API routes

JSON in and out, under `/api`. Everything except `/api/auth/*` and `/api/test/reset` needs a session and returns `401` without one.

Errors look like `{ "error": "message" }`. Validation errors add a field map: `{ "error": "Validation failed", "errors": { "email": "Email is required" } }`.

| Method and path                         | Success | Errors                                                              |
|-----------------------------------------|---------|---------------------------------------------------------------------|
| `POST /api/auth/login`                  | 200     | 400 validation, 401 wrong credentials, 403 disabled account         |
| `POST /api/auth/logout`                 | 204     |                                                                     |
| `GET /api/auth/me`                      | 200     | 401                                                                 |
| `GET /api/users`                        | 200     | 403 not admin                                                       |
| `GET /api/candidates`                   | 200     | 400 invalid query parameter                                         |
| `POST /api/candidates`                  | 201     | 400 validation, 409 duplicate email                                 |
| `GET /api/candidates/:id`               | 200     | 404                                                                 |
| `PUT /api/candidates/:id`               | 200     | 400, 404, 409 duplicate email or reverting to draft                 |
| `PATCH /api/candidates/:id/status`      | 200     | 400, 404, 409 same status or candidate is a draft                   |
| `DELETE /api/candidates/:id`            | 204     | 403 not admin, 404                                                  |
| `GET /api/candidates/:id/notes`         | 200     | 404                                                                 |
| `POST /api/candidates/:id/notes`        | 201     | 400, 404                                                            |
| `PUT /api/candidates/:id/notes/:noteId` | 200     | 400, 403 not author or admin, 404                                   |
| `DELETE /api/candidates/:id/notes/:noteId` | 204  | 403 not author or admin, 404                                        |
| `POST /api/candidates/:id/cv`           | 200     | 400 no file or empty file, 413 over 2MB, 415 wrong type, 404        |
| `GET /api/candidates/:id/cv`            | 200     | 404 (file download)                                                 |
| `DELETE /api/candidates/:id/cv`         | 204     | 404                                                                 |
| `GET /api/jobs`                         | 200     | 400 invalid status                                                  |
| `POST /api/jobs`                        | 201     | 400                                                                 |
| `GET /api/jobs/:id`                     | 200     | 404                                                                 |
| `PUT /api/jobs/:id`                     | 200     | 400, 404                                                            |
| `DELETE /api/jobs/:id`                  | 204     | 403 not admin, 404                                                  |
| `GET /api/pipeline`                     | 200     | 400 invalid query parameter                                         |
| `POST /api/pipeline`                    | 201     | 400, 404 unknown candidate or job, 409 (see pipeline rules)         |
| `GET /api/pipeline/:id`                 | 200     | 404                                                                 |
| `PATCH /api/pipeline/:id`               | 200     | 400, 404, 409 same stage or final stage                             |
| `DELETE /api/pipeline/:id`              | 204     | 404                                                                 |
| `POST /api/test/reset`                  | 200     | 404 unless `NODE_ENV=test`                                          |

Query parameters:

- `GET /api/candidates`: `search` (name), `status`, `skill`, `sort` (`name`, `email`, `location`, `status`, `salary`, `createdAt`), `order` (`asc`, `desc`), `page` (default 1), `pageSize` (1–100, default 10). Returns `{ data, page, pageSize, total, totalPages }`. Blank values sort last.
- `GET /api/jobs`: `search` (title or client), `status`. Returns `{ data, total }`; each job includes `applicationCount`.
- `GET /api/pipeline`: `jobId`, `candidateId`, `stage`. Returns `{ data, total }`; each entry includes `candidateName`, `jobTitle` and `client`.

The CV upload is `multipart/form-data` with the file in a field named `cv`.

## Validation rules

The same rules run in the browser and on the server (`public/js/validators.js`).

### Login

- Email: required, valid format
- Password: required

### Candidate intake

Step 1, personal details:

- First name, last name: required, 2–50 characters, letters, spaces, hyphens and apostrophes only
- Email: required, valid format, unique across candidates (409 from the API)
- Phone: required, digits with optional leading `+`, spaces, brackets and hyphens, 7–15 digits
- Location: required, 2–100 characters

Step 2, employment history:

- At least 1 role, at most 10
- Company, job title: required, 2–100 characters
- Start date: required, valid date, not in the future
- End date: required unless "I currently work here" is ticked, not in the future, on or after the start date

Step 3, skills and salary:

- Skills: 1–10, chosen from the fixed list
- Minimum salary, maximum salary: required whole numbers between £10,000 and £500,000
- Maximum salary must be greater than or equal to minimum salary

Step 4, right to work and availability:

- Right to work: required (citizen, settled status, or visa required)
- Visa type (2–50 characters) and visa expiry date are shown and required only when "Visa required" is selected; the expiry date must be in the future
- Availability: required (immediately, after a notice period, or from a date)
- Notice period is shown and required only for "After a notice period": whole number, 1–26 weeks
- Available from is shown and required only for "From a specific date": today or later, within 12 months

Step 5, review:

- The confirmation checkbox must be ticked (browser only)

Save as draft: only first and last name are required, but anything else filled in must still pass its format, range and date rules. Drafts have the status `Draft`, cannot be assigned to jobs, and become `Active` when submitted.

### Candidate status

- One of Active, Interviewing, Placed, Unavailable
- Must differ from the current status; drafts cannot be changed this way
- Every change is recorded in the status history with the user and time

### Notes

- Text: required, at most 1000 characters

### CV upload

- A file must be chosen and must not be empty
- Extension must be `.pdf` or `.docx`
- Size at most 2MB

### Jobs

- Title: required, 3–100 characters
- Client: required, 2–100 characters
- Location: optional, 2–100 characters
- Minimum and maximum salary: same rules as candidate salary
- Status: required, one of Draft, Open, On Hold, Closed
- Description: optional, at most 2000 characters

### Pipeline

- Stages: Applied, Screening, Interview, Offer, Placed, Rejected
- A new pairing starts at Applied
- Only submitted (non-draft) candidates can be assigned, only to Open jobs, and only once per job
- A stage change must be to a different stage, and the UI asks for confirmation first
- Placed and Rejected are final: the pairing cannot be moved again (it can still be removed)
- Moving a pairing to Placed also sets the candidate's status to Placed
