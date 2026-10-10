const { test, expect } = require('../../fixtures')
const { USERS } = require('../../support/env')
const { SEED } = require('../../data/constants')
const { buildCandidate, buildJob } = require('../../data/builders')

test.describe('Auth API', { tag: '@regression' }, () => {
  test.describe('without a session', () => {
    test.use({ role: 'anonymous' })

    test('logs in with valid credentials', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: { email: USERS.recruiter.email, password: USERS.recruiter.password }
      })

      expect(response.status()).toBe(200)
      const { user } = await response.json()
      expect(user).toMatchObject({ name: USERS.recruiter.name, email: USERS.recruiter.email, role: 'recruiter' })
      expect(user).not.toHaveProperty('password')

      // The login response sets the session cookie that later requests use
      const me = await request.get('/api/auth/me')
      expect(me.status()).toBe(200)
      expect((await me.json()).user.email).toBe(USERS.recruiter.email)
    })

    test('treats the email as case-insensitive', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: { email: USERS.admin.email.toUpperCase(), password: USERS.admin.password }
      })

      expect(response.status()).toBe(200)
      expect((await response.json()).user.role).toBe('admin')
    })

    test('returns 400 with field errors for an empty body', async ({ request }) => {
      const response = await request.post('/api/auth/login', { data: {} })

      expect(response.status()).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Validation failed',
        errors: { email: 'Email is required', password: 'Password is required' }
      })
    })

    test('returns 400 for a malformed email', async ({ request }) => {
      const response = await request.post('/api/auth/login', { data: { email: 'nope', password: 'x' } })

      expect(response.status()).toBe(400)
      expect((await response.json()).errors.email).toBe('Enter a valid email address, like name@example.com')
    })

    test('returns 401 for a wrong password', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: { email: USERS.recruiter.email, password: 'WrongPassword1!' }
      })

      expect(response.status()).toBe(401)
      expect(await response.json()).toEqual({ error: 'Invalid email or password' })
    })

    test('returns 403 for a disabled account', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: { email: USERS.disabled.email, password: USERS.disabled.password }
      })

      expect(response.status()).toBe(403)
      expect(await response.json()).toEqual({ error: 'This account has been disabled' })
    })

    test('returns 400 for a body that is not valid JSON', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        headers: { 'Content-Type': 'application/json' },
        data: Buffer.from('{ not json')
      })

      expect(response.status()).toBe(400)
      expect(await response.json()).toEqual({ error: 'Request body is not valid JSON' })
    })

    const protectedRoutes = [
      ['get', '/api/auth/me'],
      ['get', '/api/users'],
      ['get', '/api/candidates'],
      ['post', '/api/candidates', buildCandidate()],
      ['get', '/api/candidates/1'],
      ['put', '/api/candidates/1', buildCandidate()],
      ['patch', '/api/candidates/1/status', { status: 'Placed' }],
      ['delete', '/api/candidates/1'],
      ['get', '/api/candidates/1/notes'],
      ['post', '/api/candidates/1/notes', { text: 'No session' }],
      ['delete', '/api/candidates/1/notes/1'],
      ['get', '/api/candidates/1/cv'],
      ['get', '/api/jobs'],
      ['post', '/api/jobs', buildJob()],
      ['put', '/api/jobs/1', buildJob()],
      ['delete', '/api/jobs/1'],
      ['get', '/api/pipeline'],
      ['post', '/api/pipeline', { candidateId: 1, jobId: 2 }],
      ['patch', '/api/pipeline/1', { stage: 'Offer' }],
      ['delete', '/api/pipeline/1']
    ]
    for (const [method, url, data] of protectedRoutes) {
      test(`${method.toUpperCase()} ${url} requires a session`, async ({ request }) => {
        const response = await request[method](url, data ? { data } : undefined)

        expect(response.status()).toBe(401)
        expect(await response.json()).toEqual({ error: 'Authentication required' })
      })
    }

    test('rejected requests change nothing', async ({ request, adminRequest }) => {
      await request.delete('/api/candidates/1')
      await request.post('/api/candidates', { data: buildCandidate() })

      const list = await (await adminRequest.get('/api/candidates')).json()
      expect(list.total).toBe(SEED.candidates)
    })

    test('logging out ends the session', async ({ request }) => {
      await request.post('/api/auth/login', { data: { email: USERS.recruiter.email, password: USERS.recruiter.password } })
      expect((await request.get('/api/candidates')).status()).toBe(200)

      const logout = await request.post('/api/auth/logout')
      expect(logout.status()).toBe(204)

      expect((await request.get('/api/auth/me')).status()).toBe(401)
      expect((await request.get('/api/candidates')).status()).toBe(401)
    })

    test('the test reset endpoint works without a session', async ({ request }) => {
      const response = await request.post('/api/test/reset')

      expect(response.status()).toBe(200)
      expect((await response.json()).counts).toMatchObject({ candidates: SEED.candidates, jobs: SEED.jobs, users: SEED.users })
    })
  })

  test.describe('roles', () => {
    test('the saved recruiter session is accepted', async ({ request }) => {
      const response = await request.get('/api/auth/me')

      expect(response.status()).toBe(200)
      expect((await response.json()).user).toMatchObject({ name: USERS.recruiter.name, role: 'recruiter' })
    })

    test('a recruiter cannot list users', async ({ request }) => {
      const response = await request.get('/api/users')

      expect(response.status()).toBe(403)
      expect(await response.json()).toEqual({ error: 'Admin access required' })
    })

    test('an admin can list users, without passwords', async ({ adminRequest }) => {
      const response = await adminRequest.get('/api/users')

      expect(response.status()).toBe(200)
      const { data, total } = await response.json()
      expect(total).toBe(SEED.users)
      expect(data.map(user => user.email)).toEqual(expect.arrayContaining([USERS.admin.email, USERS.recruiter.email]))
      for (const user of data) expect(user).not.toHaveProperty('password')
    })

    test('unknown API routes return a JSON 404', async ({ request }) => {
      const response = await request.get('/api/no-such-route')

      expect(response.status()).toBe(404)
      expect(await response.json()).toEqual({ error: 'API route not found' })
    })
  })
})
