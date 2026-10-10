const { test, expect } = require('../../fixtures')
const { USERS } = require('../../support/env')
const { SEED } = require('../../data/constants')
const { buildCandidate, buildRole, buildNote, isoDate } = require('../../data/builders')
const { buildFile, MB } = require('../../data/files')

const SALARY_RANGE = 'between £10,000 and £500,000'

test.describe('Candidates API', { tag: '@regression' }, () => {
  test.describe('listing', () => {
    test('returns the first page with pagination details', async ({ request }) => {
      const response = await request.get('/api/candidates')

      expect(response.status()).toBe(200)
      const body = await response.json()
      expect(body).toMatchObject({ page: 1, pageSize: 10, total: SEED.candidates, totalPages: 4 })
      expect(body.data).toHaveLength(10)
      expect(body.data[0]).toEqual(expect.objectContaining({
        id: expect.any(Number), firstName: expect.any(String), email: expect.any(String), status: expect.any(String)
      }))
    })

    test('pages through the results', async ({ request }) => {
      const last = await (await request.get('/api/candidates?page=4')).json()
      expect(last.data).toHaveLength(2)

      const beyond = await (await request.get('/api/candidates?page=99')).json()
      expect(beyond.data).toEqual([])

      const everyone = await (await request.get('/api/candidates?pageSize=100')).json()
      expect(everyone.data).toHaveLength(SEED.candidates)
      expect(everyone.totalPages).toBe(1)
    })

    test('searches by name and filters by status and skill', async ({ request }) => {
      const search = await (await request.get('/api/candidates?search=amara')).json()
      expect(search.data.map(c => `${c.firstName} ${c.lastName}`)).toEqual(['Amara Demoray'])

      const placed = await (await request.get('/api/candidates?status=Placed')).json()
      expect(placed.total).toBe(3)
      expect(placed.data.every(c => c.status === 'Placed')).toBe(true)

      const sql = await (await request.get('/api/candidates?skill=SQL&pageSize=100')).json()
      expect(sql.total).toBeGreaterThan(0)
      expect(sql.data.every(c => c.skills.includes('SQL'))).toBe(true)
    })

    test('sorts in both directions with blank values last', async ({ request }) => {
      const asc = await (await request.get('/api/candidates?sort=salary&order=asc&pageSize=100')).json()
      const desc = await (await request.get('/api/candidates?sort=salary&order=desc&pageSize=100')).json()
      const amounts = body => body.data.map(c => c.salaryMin).filter(amount => amount !== null)

      expect(amounts(asc)).toEqual([...amounts(asc)].sort((a, b) => a - b))
      expect(amounts(desc)).toEqual([...amounts(desc)].sort((a, b) => b - a))
      // The two seeded drafts have no salary
      expect(asc.data.slice(-2).map(c => c.salaryMin)).toEqual([null, null])
      expect(desc.data.slice(-2).map(c => c.salaryMin)).toEqual([null, null])
    })

    test('returns 400 for invalid query parameters', async ({ request }) => {
      const response = await request.get('/api/candidates?status=Hired&skill=Juggling&sort=age&order=up&page=0&pageSize=500')

      expect(response.status()).toBe(400)
      const { errors } = await response.json()
      expect(Object.keys(errors).sort()).toEqual(['order', 'page', 'pageSize', 'skill', 'sort', 'status'])
    })
  })

  test.describe('create, read, update, delete', () => {
    test('creates a candidate', async ({ request }) => {
      const candidate = buildCandidate()
      const response = await request.post('/api/candidates', { data: candidate })

      expect(response.status()).toBe(201)
      const created = await response.json()
      expect(response.headers().location).toBe(`/api/candidates/${created.id}`)
      expect(created).toMatchObject({
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        skills: candidate.skills,
        salaryMin: candidate.salaryMin,
        status: 'Active',
        cv: null
      })
      expect(created.statusHistory).toEqual([
        expect.objectContaining({ status: 'Active', changedBy: USERS.recruiter.name })
      ])
    })

    test('normalises input: trims text, lowercases email, drops fields that do not apply', async ({ request }) => {
      const candidate = buildCandidate({ visaType: 'Should be dropped', noticePeriodWeeks: 8 })
      const response = await request.post('/api/candidates', {
        data: { ...candidate, firstName: `  ${candidate.firstName}  `, email: candidate.email.toUpperCase(), isAdmin: true }
      })

      expect(response.status()).toBe(201)
      const created = await response.json()
      expect(created.firstName).toBe(candidate.firstName)
      expect(created.email).toBe(candidate.email)
      expect(created.visaType).toBe('')
      expect(created.noticePeriodWeeks).toBeNull()
      expect(created).not.toHaveProperty('isAdmin')
    })

    test('reads a candidate', async ({ api, request }) => {
      const created = await api.createCandidate()
      const response = await request.get(`/api/candidates/${created.id}`)

      expect(response.status()).toBe(200)
      expect(await response.json()).toEqual(created)
    })

    test('updates a candidate', async ({ api, request }) => {
      const created = await api.createCandidate()
      const changes = buildCandidate({ email: created.email, location: 'Testville', skills: ['SQL'] })
      const response = await request.put(`/api/candidates/${created.id}`, { data: changes })

      expect(response.status()).toBe(200)
      const updated = await response.json()
      expect(updated).toMatchObject({ id: created.id, location: 'Testville', skills: ['SQL'], status: 'Active' })
      expect(updated.createdAt).toBe(created.createdAt)
      expect((await api.getCandidate(created.id)).location).toBe('Testville')
    })

    test('changes status and records it in the history', async ({ api, request }) => {
      const created = await api.createCandidate()
      const response = await request.patch(`/api/candidates/${created.id}/status`, { data: { status: 'Interviewing' } })

      expect(response.status()).toBe(200)
      const updated = await response.json()
      expect(updated.status).toBe('Interviewing')
      expect(updated.statusHistory.map(entry => entry.status)).toEqual(['Active', 'Interviewing'])
    })

    test('rejects invalid status changes', async ({ api, request }) => {
      const created = await api.createCandidate()
      const url = `/api/candidates/${created.id}/status`

      expect((await request.patch(url, { data: {} })).status()).toBe(400)
      expect((await request.patch(url, { data: { status: 'Hired' } })).status()).toBe(400)
      expect((await request.patch(url, { data: { status: 'Draft' } })).status()).toBe(400)
      expect((await request.patch(url, { data: { status: 'Active' } })).status()).toBe(409)
      // Seeded candidate 31 is a draft
      expect((await request.patch('/api/candidates/31/status', { data: { status: 'Active' } })).status()).toBe(409)
    })

    test('only an admin can delete a candidate', async ({ api, request, adminRequest }) => {
      const created = await api.createCandidate()
      await api.addNote(created.id)
      const application = await api.assign(created.id, 2)

      const asRecruiter = await request.delete(`/api/candidates/${created.id}`)
      expect(asRecruiter.status()).toBe(403)
      expect((await request.get(`/api/candidates/${created.id}`)).status()).toBe(200)

      const asAdmin = await adminRequest.delete(`/api/candidates/${created.id}`)
      expect(asAdmin.status()).toBe(204)
      expect((await request.get(`/api/candidates/${created.id}`)).status()).toBe(404)
      // The candidate's job pairings go with them
      expect((await request.get(`/api/pipeline/${application.id}`)).status()).toBe(404)
    })

    test('returns 404 for unknown or malformed ids', async ({ request }) => {
      for (const id of ['99999', 'abc', '1.5', '-1']) {
        expect((await request.get(`/api/candidates/${id}`)).status(), id).toBe(404)
      }
      expect((await request.put('/api/candidates/99999', { data: buildCandidate() })).status()).toBe(404)
      expect((await request.patch('/api/candidates/99999/status', { data: { status: 'Placed' } })).status()).toBe(404)
    })
  })

  test.describe('validation', () => {
    test('returns every required-field error for an empty body', async ({ request }) => {
      const response = await request.post('/api/candidates', { data: {} })

      expect(response.status()).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Validation failed')
      expect(body.errors).toEqual({
        firstName: 'First name is required',
        lastName: 'Last name is required',
        email: 'Email is required',
        phone: 'Phone number is required',
        location: 'Location is required',
        employmentHistory: 'Add at least one role',
        skills: 'Select at least one skill',
        salaryMin: 'Minimum salary is required',
        salaryMax: 'Maximum salary is required',
        rightToWork: 'Select a right to work option',
        availability: 'Select an availability option'
      })
    })

    const pastRole = dates => [buildRole({ current: false, ...dates })]
    const invalidCases = [
      ['a missing first name', { firstName: '' }, 'firstName', 'First name is required'],
      ['a one-letter last name', { lastName: 'X' }, 'lastName', 'Last name must be between 2 and 50 characters'],
      ['digits in a name', { firstName: 'J0hn' }, 'firstName', 'First name can only contain letters, spaces, hyphens and apostrophes'],
      ['a malformed email', { email: 'not-an-email' }, 'email', 'Enter a valid email address, like name@example.com'],
      ['a phone number that is too short', { phone: '12345' }, 'phone', 'Enter a valid phone number with 7 to 15 digits'],
      ['a phone number with letters', { phone: 'call me maybe' }, 'phone', 'Enter a valid phone number with 7 to 15 digits'],
      ['a one-letter location', { location: 'X' }, 'location', 'Location must be between 2 and 100 characters'],
      ['no employment history', { employmentHistory: [] }, 'employmentHistory', 'Add at least one role'],
      ['more than ten roles', { employmentHistory: Array.from({ length: 11 }, () => buildRole()) }, 'employmentHistory', 'Add no more than 10 roles'],
      ['a role without a company', { employmentHistory: [buildRole({ company: '' })] }, 'employmentHistory.0.company', 'Company is required'],
      ['a start date in the future', { employmentHistory: [buildRole({ startDate: isoDate(1) })] }, 'employmentHistory.0.startDate', 'Start date cannot be in the future'],
      ['an impossible start date', { employmentHistory: [buildRole({ startDate: '2023-02-30' })] }, 'employmentHistory.0.startDate', 'Enter a valid start date'],
      ['a past role without an end date', { employmentHistory: pastRole({ endDate: '' }) }, 'employmentHistory.0.endDate', 'End date is required unless this is a current role'],
      ['an end date before the start date', { employmentHistory: pastRole({ startDate: '2020-05-01', endDate: '2019-05-01' }) }, 'employmentHistory.0.endDate', 'End date must be on or after the start date'],
      ['an end date in the future', { employmentHistory: pastRole({ endDate: isoDate(1) }) }, 'employmentHistory.0.endDate', 'End date cannot be in the future'],
      ['no skills', { skills: [] }, 'skills', 'Select at least one skill'],
      ['an unknown skill', { skills: ['Juggling'] }, 'skills', 'Select skills from the list'],
      ['a minimum salary below the range', { salaryMin: 9999 }, 'salaryMin', `Minimum salary must be ${SALARY_RANGE}`],
      ['a maximum salary above the range', { salaryMax: 500001 }, 'salaryMax', `Maximum salary must be ${SALARY_RANGE}`],
      ['a salary that is not a number', { salaryMax: 'lots' }, 'salaryMax', 'Maximum salary must be a whole number'],
      ['a salary with decimals', { salaryMin: 30000.5 }, 'salaryMin', 'Minimum salary must be a whole number'],
      ['a maximum salary below the minimum', { salaryMin: 50000, salaryMax: 40000 }, 'salaryMax', 'Maximum salary must be greater than or equal to minimum salary'],
      ['an unknown right to work', { rightToWork: 'maybe' }, 'rightToWork', 'Select a valid right to work option'],
      ['a visa without a type', { rightToWork: 'visa', visaExpiry: isoDate(400) }, 'visaType', 'Visa type is required'],
      ['a visa without an expiry date', { rightToWork: 'visa', visaType: 'Skilled Worker' }, 'visaExpiry', 'Visa expiry date is required'],
      ['an expired visa', { rightToWork: 'visa', visaType: 'Skilled Worker', visaExpiry: isoDate(-1) }, 'visaExpiry', 'Visa expiry date must be in the future'],
      ['an unknown availability', { availability: 'whenever' }, 'availability', 'Select a valid availability option'],
      ['a notice period without a length', { availability: 'notice' }, 'noticePeriodWeeks', 'Notice period is required'],
      ['a notice period over 26 weeks', { availability: 'notice', noticePeriodWeeks: 27 }, 'noticePeriodWeeks', 'Notice period must be between 1 and 26 weeks'],
      ['an availability date in the past', { availability: 'date', availableFrom: isoDate(-1) }, 'availableFrom', 'Available from date cannot be in the past'],
      ['an availability date over a year away', { availability: 'date', availableFrom: isoDate(400) }, 'availableFrom', 'Available from date must be within the next 12 months'],
      ['an unknown status', { status: 'Hired' }, 'status', 'Status must be one of: Draft, Active, Interviewing, Placed, Unavailable']
    ]
    for (const [description, overrides, field, message] of invalidCases) {
      test(`rejects ${description}`, async ({ request }) => {
        const response = await request.post('/api/candidates', { data: buildCandidate(overrides) })

        expect(response.status()).toBe(400)
        const { errors } = await response.json()
        expect(errors).toEqual({ [field]: message })
      })
    }

    test('applies the same rules to updates and leaves the record unchanged', async ({ api, request }) => {
      const created = await api.createCandidate()
      const response = await request.put(`/api/candidates/${created.id}`, {
        data: buildCandidate({ email: created.email, location: 'Changed', salaryMin: 5 })
      })

      expect(response.status()).toBe(400)
      expect((await response.json()).errors).toHaveProperty('salaryMin')
      expect(await api.getCandidate(created.id)).toEqual(created)
    })

    test('nothing is saved when validation fails', async ({ request }) => {
      await request.post('/api/candidates', { data: buildCandidate({ email: 'bad' }) })

      expect((await (await request.get('/api/candidates')).json()).total).toBe(SEED.candidates)
    })

    test('rejects a duplicate email with 409', async ({ api, request }) => {
      const existing = await api.createCandidate()
      const duplicate = await request.post('/api/candidates', { data: buildCandidate({ email: existing.email.toUpperCase() }) })

      expect(duplicate.status()).toBe(409)
      expect(await duplicate.json()).toEqual({
        error: 'A candidate with this email already exists',
        errors: { email: 'A candidate with this email already exists' }
      })

      const other = await api.createCandidate()
      const update = await request.put(`/api/candidates/${other.id}`, { data: buildCandidate({ email: existing.email }) })
      expect(update.status()).toBe(409)
    })
  })

  test.describe('drafts', () => {
    test('a draft needs only a name', async ({ request }) => {
      const response = await request.post('/api/candidates', {
        data: { firstName: 'Drafty', lastName: 'Sample', status: 'Draft' }
      })

      expect(response.status()).toBe(201)
      expect(await response.json()).toMatchObject({ status: 'Draft', email: '', skills: [], salaryMin: null })
    })

    test('a draft still needs a name and valid formats', async ({ request }) => {
      const response = await request.post('/api/candidates', {
        data: { firstName: '', lastName: 'Sample', email: 'bad', salaryMin: 5, status: 'Draft' }
      })

      expect(response.status()).toBe(400)
      expect(Object.keys((await response.json()).errors).sort()).toEqual(['email', 'firstName', 'salaryMin'])
    })

    test('submitting a draft needs the full details and makes it Active', async ({ api, request }) => {
      const draft = await api.createDraft({ firstName: 'Drafty', lastName: 'Sample' })

      const incomplete = await request.put(`/api/candidates/${draft.id}`, {
        data: { firstName: 'Drafty', lastName: 'Sample', status: 'Active' }
      })
      expect(incomplete.status()).toBe(400)

      const complete = await request.put(`/api/candidates/${draft.id}`, { data: buildCandidate() })
      expect(complete.status()).toBe(200)
      const submitted = await complete.json()
      expect(submitted.status).toBe('Active')
      expect(submitted.statusHistory.map(entry => entry.status)).toEqual(['Draft', 'Active'])
    })

    test('a submitted candidate cannot go back to draft', async ({ api, request }) => {
      const created = await api.createCandidate()
      const response = await request.put(`/api/candidates/${created.id}`, {
        data: { ...buildCandidate({ email: created.email }), status: 'Draft' }
      })

      expect(response.status()).toBe(409)
      expect((await api.getCandidate(created.id)).status).toBe('Active')
    })
  })

  test.describe('notes', () => {
    test('creates, lists, updates and deletes a note', async ({ api, request }) => {
      const candidate = await api.createCandidate()
      const url = `/api/candidates/${candidate.id}/notes`
      const note = buildNote()

      const created = await request.post(url, { data: note })
      expect(created.status()).toBe(201)
      const saved = await created.json()
      expect(saved).toMatchObject({ candidateId: candidate.id, text: note.text, authorName: USERS.recruiter.name })

      const list = await (await request.get(url)).json()
      expect(list).toEqual({ data: [saved], total: 1 })

      const updated = await request.put(`${url}/${saved.id}`, { data: { text: 'Edited text' } })
      expect(updated.status()).toBe(200)
      expect((await updated.json()).text).toBe('Edited text')

      expect((await request.delete(`${url}/${saved.id}`)).status()).toBe(204)
      expect((await request.delete(`${url}/${saved.id}`)).status()).toBe(404)
      expect((await (await request.get(url)).json()).total).toBe(0)
    })

    test('validates note text', async ({ api, request }) => {
      const candidate = await api.createCandidate()
      const url = `/api/candidates/${candidate.id}/notes`

      const empty = await request.post(url, { data: { text: '   ' } })
      expect(empty.status()).toBe(400)
      expect((await empty.json()).errors).toEqual({ text: 'Note text is required' })

      const tooLong = await request.post(url, { data: { text: 'x'.repeat(1001) } })
      expect(tooLong.status()).toBe(400)
      expect((await tooLong.json()).errors).toEqual({ text: 'Note must be 1000 characters or fewer' })

      expect((await request.post(url, { data: { text: 'x'.repeat(1000) } })).status()).toBe(201)
    })

    test('only the author or an admin can change a note', async ({ request, adminRequest }) => {
      // Seeded note 2 on candidate 1 was written by the admin
      const url = '/api/candidates/1/notes/2'

      const edit = await request.put(url, { data: { text: 'Not mine to edit' } })
      expect(edit.status()).toBe(403)
      expect((await request.delete(url)).status()).toBe(403)

      // Seeded note 1 on candidate 1 was written by the recruiter
      expect((await adminRequest.put('/api/candidates/1/notes/1', { data: { text: 'Admin edit' } })).status()).toBe(200)
      expect((await adminRequest.delete(url)).status()).toBe(204)
    })

    test('a note is only reachable through its own candidate', async ({ request }) => {
      // Note 1 belongs to candidate 1, not candidate 2
      expect((await request.put('/api/candidates/2/notes/1', { data: { text: 'Wrong candidate' } })).status()).toBe(404)
      expect((await request.get('/api/candidates/99999/notes')).status()).toBe(404)
    })
  })

  test.describe('CV upload', () => {
    let url

    test.beforeEach(async ({ api }) => {
      const candidate = await api.createCandidate()
      url = `/api/candidates/${candidate.id}/cv`
    })

    test('uploads, downloads and deletes a CV', async ({ request }) => {
      const file = buildFile('sample.pdf', 3000)
      const upload = await request.post(url, { multipart: { cv: file } })

      expect(upload.status()).toBe(200)
      expect(await upload.json()).toMatchObject({ filename: 'sample.pdf', size: 3000, uploadedBy: USERS.recruiter.name })

      const download = await request.get(url)
      expect(download.status()).toBe(200)
      expect(download.headers()['content-disposition']).toContain('sample.pdf')
      expect((await download.body()).length).toBe(3000)

      expect((await request.delete(url)).status()).toBe(204)
      expect((await request.get(url)).status()).toBe(404)
      expect((await request.delete(url)).status()).toBe(404)
    })

    const rejected = [
      ['a text file', buildFile('notes.txt'), 415, 'CV must be a PDF or DOCX file'],
      ['an image', buildFile('photo.png'), 415, 'CV must be a PDF or DOCX file'],
      ['a file over 2MB', buildFile('big.docx', 2 * MB + 1), 413, 'CV must be 2MB or smaller'],
      ['an empty file', buildFile('empty.pdf', 0), 400, 'The selected file is empty']
    ]
    for (const [description, file, status, message] of rejected) {
      test(`rejects ${description} with ${status}`, async ({ request }) => {
        const response = await request.post(url, { multipart: { cv: file } })

        expect(response.status()).toBe(status)
        expect((await response.json()).errors).toEqual({ cv: message })
        expect((await request.get(url)).status()).toBe(404)
      })
    }

    test('returns 400 when no file is sent', async ({ request }) => {
      const response = await request.post(url, { multipart: { comment: 'no file here' } })

      expect(response.status()).toBe(400)
      expect((await response.json()).errors).toEqual({ cv: 'Choose a file to upload' })
    })

    test('returns 404 for an unknown candidate', async ({ request }) => {
      const response = await request.post('/api/candidates/99999/cv', { multipart: { cv: buildFile('sample.pdf') } })

      expect(response.status()).toBe(404)
    })
  })
})
