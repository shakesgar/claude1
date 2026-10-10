const { test, expect } = require('../../fixtures')
const { USERS } = require('../../support/env')
const { SEED, STAGES } = require('../../data/constants')
const { buildJob } = require('../../data/builders')

const SALARY_RANGE = 'between £10,000 and £500,000'

test.describe('Jobs API', { tag: '@regression' }, () => {
  test.describe('listing', () => {
    test('returns every job with its candidate count', async ({ request }) => {
      const response = await request.get('/api/jobs')

      expect(response.status()).toBe(200)
      const { data, total } = await response.json()
      expect(total).toBe(SEED.jobs)
      expect(data).toHaveLength(SEED.jobs)
      for (const job of data) expect(job.applicationCount).toEqual(expect.any(Number))
    })

    test('filters by status and searches title and client', async ({ request }) => {
      const open = await (await request.get('/api/jobs?status=Open')).json()
      expect(open.total).toBe(5)
      expect(open.data.every(job => job.status === 'Open')).toBe(true)

      const byTitle = await (await request.get('/api/jobs?search=analyst')).json()
      expect(byTitle.data.map(job => job.title)).toEqual(['Data Analyst'])

      const byClient = await (await request.get('/api/jobs?search=bluebird')).json()
      expect(byClient.data.map(job => job.client)).toEqual(['Bluebird Sample Co'])
    })

    test('returns 400 for an unknown status filter', async ({ request }) => {
      const response = await request.get('/api/jobs?status=Archived')

      expect(response.status()).toBe(400)
      expect((await response.json()).errors).toHaveProperty('status')
    })
  })

  test.describe('create, read, update, delete', () => {
    test('creates a job', async ({ request }) => {
      const job = buildJob()
      const response = await request.post('/api/jobs', { data: job })

      expect(response.status()).toBe(201)
      const created = await response.json()
      expect(response.headers().location).toBe(`/api/jobs/${created.id}`)
      expect(created).toMatchObject({ ...job, applicationCount: 0 })
      expect(created.id).toBeGreaterThan(SEED.jobs)
    })

    test('reads a job', async ({ api, request }) => {
      const created = await api.createJob()
      const response = await request.get(`/api/jobs/${created.id}`)

      expect(response.status()).toBe(200)
      expect(await response.json()).toEqual(created)
    })

    test('updates a job', async ({ api, request }) => {
      const created = await api.createJob()
      const changes = buildJob({ title: 'Renamed Demo Role', status: 'Closed' })
      const response = await request.put(`/api/jobs/${created.id}`, { data: changes })

      expect(response.status()).toBe(200)
      expect(await response.json()).toMatchObject({ id: created.id, title: 'Renamed Demo Role', status: 'Closed', createdAt: created.createdAt })
    })

    test('only an admin can delete a job', async ({ api, request, adminRequest }) => {
      const job = await api.createJob()
      const candidate = await api.createCandidate()
      const application = await api.assign(candidate.id, job.id)

      expect((await request.delete(`/api/jobs/${job.id}`)).status()).toBe(403)
      expect((await adminRequest.delete(`/api/jobs/${job.id}`)).status()).toBe(204)
      expect((await request.get(`/api/jobs/${job.id}`)).status()).toBe(404)
      // The job's pairings are removed, but the candidate stays
      expect((await request.get(`/api/pipeline/${application.id}`)).status()).toBe(404)
      expect((await request.get(`/api/candidates/${candidate.id}`)).status()).toBe(200)
    })

    test('returns 404 for unknown ids', async ({ request, adminRequest }) => {
      expect((await request.get('/api/jobs/99999')).status()).toBe(404)
      expect((await request.get('/api/jobs/abc')).status()).toBe(404)
      expect((await request.put('/api/jobs/99999', { data: buildJob() })).status()).toBe(404)
      expect((await adminRequest.delete('/api/jobs/99999')).status()).toBe(404)
    })
  })

  test.describe('validation', () => {
    test('returns every required-field error for an empty body', async ({ request }) => {
      const response = await request.post('/api/jobs', { data: {} })

      expect(response.status()).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Validation failed',
        errors: {
          title: 'Job title is required',
          client: 'Client is required',
          salaryMin: 'Minimum salary is required',
          salaryMax: 'Maximum salary is required',
          status: 'Status is required'
        }
      })
    })

    const invalidCases = [
      ['a two-letter title', { title: 'QA' }, 'title', 'Job title must be between 3 and 100 characters'],
      ['a title over 100 characters', { title: 'T'.repeat(101) }, 'title', 'Job title must be between 3 and 100 characters'],
      ['a one-letter client', { client: 'X' }, 'client', 'Client must be between 2 and 100 characters'],
      ['a one-letter location', { location: 'X' }, 'location', 'Location must be between 2 and 100 characters'],
      ['a salary below the range', { salaryMin: 9999 }, 'salaryMin', `Minimum salary must be ${SALARY_RANGE}`],
      ['a salary above the range', { salaryMax: 500001 }, 'salaryMax', `Maximum salary must be ${SALARY_RANGE}`],
      ['a salary that is not a number', { salaryMin: 'competitive' }, 'salaryMin', 'Minimum salary must be a whole number'],
      ['a maximum salary below the minimum', { salaryMin: 60000, salaryMax: 50000 }, 'salaryMax', 'Maximum salary must be greater than or equal to minimum salary'],
      ['an unknown status', { status: 'Archived' }, 'status', 'Status must be one of: Draft, Open, On Hold, Closed'],
      ['a description over 2000 characters', { description: 'd'.repeat(2001) }, 'description', 'Description must be 2000 characters or fewer']
    ]
    for (const [description, overrides, field, message] of invalidCases) {
      test(`rejects ${description}`, async ({ request }) => {
        const response = await request.post('/api/jobs', { data: buildJob(overrides) })

        expect(response.status()).toBe(400)
        expect((await response.json()).errors).toEqual({ [field]: message })
      })
    }

    test('location and description are optional', async ({ request }) => {
      const response = await request.post('/api/jobs', { data: buildJob({ location: '', description: '' }) })

      expect(response.status()).toBe(201)
    })

    test('applies the same rules to updates and leaves the job unchanged', async ({ api, request }) => {
      const created = await api.createJob()
      const response = await request.put(`/api/jobs/${created.id}`, { data: buildJob({ title: '' }) })

      expect(response.status()).toBe(400)
      expect(await (await request.get(`/api/jobs/${created.id}`)).json()).toEqual(created)
    })
  })

  test.describe('assigning candidates (pipeline)', () => {
    test('assigns a candidate to an open job at the Applied stage', async ({ api, request }) => {
      const job = await api.createJob()
      const candidate = await api.createCandidate()
      const response = await request.post('/api/pipeline', { data: { candidateId: candidate.id, jobId: job.id } })

      expect(response.status()).toBe(201)
      const application = await response.json()
      expect(application).toMatchObject({
        candidateId: candidate.id,
        jobId: job.id,
        stage: 'Applied',
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        jobTitle: job.title,
        client: job.client
      })
      expect(application.history).toEqual([expect.objectContaining({ stage: 'Applied', changedBy: USERS.recruiter.name })])
      expect((await (await request.get(`/api/jobs/${job.id}`)).json()).applicationCount).toBe(1)
    })

    test('rejects invalid assignments', async ({ api, request }) => {
      const candidate = await api.createCandidate()
      const closed = await api.createJob({ status: 'Closed' })
      const post = data => request.post('/api/pipeline', { data })

      const missing = await post({})
      expect(missing.status()).toBe(400)
      expect((await missing.json()).errors).toEqual({ candidateId: 'Candidate is required', jobId: 'Job is required' })

      expect((await post({ candidateId: 'abc', jobId: 2 })).status()).toBe(400)
      expect((await post({ candidateId: 99999, jobId: 2 })).status()).toBe(404)
      expect((await post({ candidateId: candidate.id, jobId: 99999 })).status()).toBe(404)
      // Seeded candidate 31 is a draft
      expect((await post({ candidateId: 31, jobId: 2 })).status()).toBe(409)
      expect((await post({ candidateId: candidate.id, jobId: closed.id })).status()).toBe(409)

      expect((await post({ candidateId: candidate.id, jobId: 2 })).status()).toBe(201)
      const duplicate = await post({ candidateId: candidate.id, jobId: 2 })
      expect(duplicate.status()).toBe(409)
      expect(await duplicate.json()).toEqual({ error: 'This candidate is already assigned to this job' })
    })

    test('moves a pairing through the stages and makes Placed final', async ({ api, request }) => {
      const candidate = await api.createCandidate()
      const application = await api.assign(candidate.id, 2)
      const url = `/api/pipeline/${application.id}`

      for (const stage of ['Screening', 'Interview', 'Offer', 'Placed']) {
        const response = await request.patch(url, { data: { stage } })
        expect(response.status(), stage).toBe(200)
        expect((await response.json()).stage).toBe(stage)
      }

      const saved = await api.getApplication(application.id)
      expect(saved.history.map(entry => entry.stage)).toEqual(['Applied', 'Screening', 'Interview', 'Offer', 'Placed'])
      // Placing a candidate also updates the candidate's own status
      expect((await api.getCandidate(candidate.id)).status).toBe('Placed')

      const afterFinal = await request.patch(url, { data: { stage: 'Offer' } })
      expect(afterFinal.status()).toBe(409)
      expect(await afterFinal.json()).toEqual({ error: 'Placed is a final stage and cannot be changed' })
    })

    test('rejects invalid stage changes', async ({ api, request }) => {
      const candidate = await api.createCandidate()
      const application = await api.assign(candidate.id, 2)
      const url = `/api/pipeline/${application.id}`

      expect((await request.patch(url, { data: {} })).status()).toBe(400)
      expect((await request.patch(url, { data: { stage: 'Hired' } })).status()).toBe(400)
      expect((await request.patch(url, { data: { stage: 'Applied' } })).status()).toBe(409)
      expect((await request.patch('/api/pipeline/99999', { data: { stage: 'Offer' } })).status()).toBe(404)
    })

    test('filters the pipeline by job, candidate and stage', async ({ api, request }) => {
      const job = await api.createJob()
      const first = await api.createCandidate()
      const second = await api.createCandidate()
      await api.assign(first.id, job.id)
      const moved = await api.assign(second.id, job.id)
      await api.moveTo(moved.id, 'Offer')

      const byJob = await (await request.get(`/api/pipeline?jobId=${job.id}`)).json()
      expect(byJob.total).toBe(2)

      const byCandidate = await (await request.get(`/api/pipeline?candidateId=${first.id}`)).json()
      expect(byCandidate.data.map(entry => entry.jobId)).toEqual([job.id])

      const byStage = await (await request.get(`/api/pipeline?jobId=${job.id}&stage=Offer`)).json()
      expect(byStage.data.map(entry => entry.candidateId)).toEqual([second.id])

      for (const stage of STAGES) {
        expect((await request.get(`/api/pipeline?stage=${stage}`)).status(), stage).toBe(200)
      }
      expect((await request.get('/api/pipeline?stage=Hired&jobId=x')).status()).toBe(400)
    })

    test('removes a pairing', async ({ api, request }) => {
      const candidate = await api.createCandidate()
      const application = await api.assign(candidate.id, 2)

      expect((await request.delete(`/api/pipeline/${application.id}`)).status()).toBe(204)
      expect((await request.delete(`/api/pipeline/${application.id}`)).status()).toBe(404)
    })
  })
})
