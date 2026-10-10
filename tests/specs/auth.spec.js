const { test, expect } = require('../fixtures')
const { USERS } = require('../support/env')
const { SEED } = require('../data/constants')

test.describe('Authentication', { tag: '@regression' }, () => {
  test.describe('logging in', () => {
    test.use({ role: 'anonymous' })

    test.beforeEach(async ({ loginPage }) => {
      await loginPage.goto()
    })

    test('rejects a wrong password', async ({ loginPage, page }) => {
      await loginPage.login(USERS.recruiter.email, 'WrongPassword1!')

      await expect(loginPage.error).toHaveText('Invalid email or password')
      await expect(page).toHaveURL(/\/login$/)
    })

    test('rejects an unknown email without revealing that it is unknown', async ({ loginPage }) => {
      await loginPage.login('nobody@example.com', USERS.recruiter.password)

      await expect(loginPage.error).toHaveText('Invalid email or password')
    })

    test('rejects a disabled account', async ({ loginPage, page }) => {
      await loginPage.loginAs(USERS.disabled)

      await expect(loginPage.error).toHaveText('This account has been disabled')
      await expect(page).toHaveURL(/\/login$/)
    })

    test('requires an email and a password', async ({ loginPage }) => {
      await loginPage.submitButton.click()

      await expect(loginPage.emailError).toHaveText('Email is required')
      await expect(loginPage.passwordError).toHaveText('Password is required')
      await expect(loginPage.emailInput).toHaveAttribute('aria-invalid', 'true')
      await expect(loginPage.error).toBeHidden()
    })

    test('requires a well-formed email', async ({ loginPage }) => {
      await loginPage.login('not-an-email', USERS.recruiter.password)

      await expect(loginPage.emailError).toHaveText('Enter a valid email address, like name@example.com')
    })

    test('clears the error after a successful retry', async ({ loginPage, page }) => {
      await loginPage.login(USERS.recruiter.email, 'WrongPassword1!')
      await expect(loginPage.error).toBeVisible()

      await loginPage.loginAs(USERS.recruiter)
      await expect(page).toHaveURL(/\/candidates$/)
    })

    test('returns to the page that was requested before login', async ({ loginPage, page }) => {
      await page.goto('/jobs')
      await expect(page).toHaveURL(/\/login\?next=%2Fjobs$/)

      await loginPage.loginAs(USERS.recruiter)
      await expect(page).toHaveURL(/\/jobs$/)
    })
  })

  test.describe('session persistence', () => {
    test.use({ role: 'anonymous' })

    test('the session survives a reload and is shared by new tabs', async ({ loginPage, navBar, page, context }) => {
      await loginPage.goto()
      await loginPage.loginAs(USERS.recruiter)
      await expect(navBar.userName).toHaveText(USERS.recruiter.name)

      await page.reload()
      await expect(page).toHaveURL(/\/candidates$/)
      await expect(navBar.userName).toHaveText(USERS.recruiter.name)

      const secondTab = await context.newPage()
      await secondTab.goto('/jobs')
      await expect(secondTab).toHaveURL(/\/jobs$/)
      await expect(secondTab.getByTestId('current-user-name')).toHaveText(USERS.recruiter.name)
    })

    test('losing the session cookie sends the user back to login', async ({ loginPage, navBar, page, context }) => {
      await loginPage.goto()
      await loginPage.loginAs(USERS.recruiter)
      await expect(navBar.userName).toBeVisible()

      await context.clearCookies()
      await page.goto('/candidates')
      await expect(page).toHaveURL(/\/login\?next=%2Fcandidates$/)
    })

    test('signed-out visitors cannot open protected pages', async ({ page }) => {
      for (const path of ['/candidates', '/candidates/new', '/candidates/1', '/jobs', '/pipeline', '/users']) {
        await page.goto(path)
        await expect(page, path).toHaveURL(/\/login\?next=/)
      }
    })
  })

  test.describe('as a recruiter', () => {
    test('the saved session starts tests already signed in', async ({ navBar, page }) => {
      await page.goto('/candidates')

      await expect(navBar.userName).toHaveText(USERS.recruiter.name)
      await expect(navBar.userRole).toHaveText('recruiter')
    })

    test('the Users page is blocked', async ({ navBar, page, request }) => {
      await page.goto('/candidates')
      await expect(navBar.link('Candidates')).toBeVisible()
      await expect(navBar.link('Users')).toHaveCount(0)

      const response = await page.goto('/users')
      expect(response.status()).toBe(403)
      await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
      await expect(page.getByTestId('forbidden-message')).toHaveText('You need an admin account to view this page.')
      await expect(page.getByTestId('users-table')).toHaveCount(0)

      const api = await request.get('/api/users')
      expect(api.status()).toBe(403)
    })

    test('admin-only actions are not offered', async ({ candidateProfilePage }) => {
      await candidateProfilePage.goto(1)

      await expect(candidateProfilePage.name).toBeVisible()
      await expect(candidateProfilePage.deleteButton).toBeHidden()
    })
  })

  test.describe('as an admin', () => {
    test.use({ role: 'admin' })

    test('the Users page lists every account', async ({ navBar, page }) => {
      await page.goto('/candidates')
      await expect(navBar.userRole).toHaveText('admin')
      await navBar.goTo('Users')

      await expect(page).toHaveURL(/\/users$/)
      await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible()
      await expect(page.getByTestId('user-row')).toHaveCount(SEED.users)
      await expect(page.getByTestId('user-email')).toContainText([USERS.admin.email, USERS.recruiter.email])
    })

    test('an admin can delete a candidate', async ({ api, candidateProfilePage, candidateListPage, page }) => {
      const candidate = await api.createCandidate()
      await candidateProfilePage.goto(candidate.id)

      await candidateProfilePage.deleteButton.click()
      await expect(candidateProfilePage.confirmDialog.title).toHaveText('Delete candidate')
      await candidateProfilePage.confirmDialog.accept()

      await expect(page).toHaveURL(/\/candidates$/)
      await candidateListPage.toast.expectSuccess(`${candidate.firstName} ${candidate.lastName} was deleted`)
      await candidateProfilePage.goto(candidate.id)
      await expect(candidateProfilePage.notFoundMessage).toBeVisible()
    })
  })
})
