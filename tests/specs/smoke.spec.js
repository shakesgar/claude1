const { test, expect } = require('../fixtures')
const { USERS } = require('../support/env')
const { SEED } = require('../data/constants')
const { buildCandidate, fullName } = require('../data/builders')

test.describe('Smoke', { tag: '@smoke' }, () => {
  test.describe('signing in and out', () => {
    test.use({ role: 'anonymous' })

    test('a recruiter can log in', async ({ loginPage, navBar, page }) => {
      await loginPage.goto()
      await loginPage.loginAs(USERS.recruiter)

      await expect(page).toHaveURL(/\/candidates$/)
      await expect(navBar.userName).toHaveText(USERS.recruiter.name)
      await expect(navBar.userRole).toHaveText('recruiter')
    })

    // Logs in through the UI so that logging out does not end the shared saved session
    test('a signed-in user can log out', async ({ loginPage, navBar, page }) => {
      await loginPage.goto()
      await loginPage.loginAs(USERS.recruiter)
      await expect(navBar.userName).toBeVisible()

      await navBar.logout()
      await expect(page).toHaveURL(/\/login$/)

      await page.goto('/candidates')
      await expect(page).toHaveURL(/\/login\?next=/)
    })
  })

  test('the candidate list loads', async ({ candidateListPage }) => {
    await candidateListPage.goto()

    await expect(candidateListPage.heading).toBeVisible()
    await expect(candidateListPage.table.rows).toHaveCount(SEED.pageSize)
    await expect(candidateListPage.resultCount).toHaveText(`Showing 1–10 of ${SEED.candidates} candidates`)
  })

  test('a recruiter can create a candidate end to end', async ({ candidateListPage, candidateFormPage, candidateProfilePage }) => {
    const candidate = buildCandidate()
    const name = fullName(candidate)

    await candidateListPage.goto()
    await candidateListPage.addCandidateLink.click()
    await candidateFormPage.expectStep(1)
    await candidateFormPage.createCandidate(candidate)

    await candidateProfilePage.toast.expectSuccess('Candidate submitted')
    await expect(candidateProfilePage.name).toHaveText(name)
    await expect(candidateProfilePage.status).toHaveText('Active')
    await expect(candidateProfilePage.detail('email')).toHaveText(candidate.email)

    await candidateListPage.goto()
    await candidateListPage.search(name)
    await expect(candidateListPage.candidateLink(name)).toBeVisible()
    await expect(candidateListPage.resultCount).toHaveText('Showing 1–1 of 1 candidate')
  })
})
