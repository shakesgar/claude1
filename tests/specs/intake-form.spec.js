const { test, expect } = require('../fixtures')
const { SKILLS } = require('../data/constants')
const { buildCandidate, buildRole, isoDate, fullName, money } = require('../data/builders')

const INVALID_EMAIL = 'Enter a valid email address, like name@example.com'
const INVALID_PHONE = 'Enter a valid phone number with 7 to 15 digits'
const SALARY_RANGE = 'between £10,000 and £500,000'

// A candidate who takes the visa and notice-period branches of step 4
const visaCandidate = (overrides = {}) => buildCandidate({
  rightToWork: 'visa',
  visaType: 'Skilled Worker',
  visaExpiry: isoDate(400),
  availability: 'notice',
  noticePeriodWeeks: 4,
  willingToRelocate: true,
  ...overrides
})

test.describe('Candidate intake form', { tag: '@regression' }, () => {
  test.beforeEach(async ({ candidateFormPage }) => {
    await candidateFormPage.goto()
  })

  test.describe('step 1: personal details', () => {
    test('requires every field', async ({ candidateFormPage: form }) => {
      await form.next()

      await expect(form.error('firstName')).toHaveText('First name is required')
      await expect(form.error('lastName')).toHaveText('Last name is required')
      await expect(form.error('email')).toHaveText('Email is required')
      await expect(form.error('phone')).toHaveText('Phone number is required')
      await expect(form.error('location')).toHaveText('Location is required')
      await expect(form.errorSummary).toContainText('There are 5 problems on this step')
      await expect(form.errorSummaryItems).toHaveCount(5)
      await expect(form.firstNameInput).toHaveAttribute('aria-invalid', 'true')
      await form.expectStep(1)
    })

    test('validates name length and characters', async ({ candidateFormPage: form }) => {
      await form.fillPersonal(buildCandidate())
      const fields = [
        [form.firstNameInput, 'firstName', 'First name'],
        [form.lastNameInput, 'lastName', 'Last name']
      ]
      for (const [input, field, label] of fields) {
        const cases = [
          ['A', `${label} must be between 2 and 50 characters`],
          ['A'.repeat(51), `${label} must be between 2 and 50 characters`],
          ['J0hn', `${label} can only contain letters, spaces, hyphens and apostrophes`],
          ['Sam_', `${label} can only contain letters, spaces, hyphens and apostrophes`]
        ]
        for (const [value, message] of cases) {
          await input.fill(value)
          await form.next()
          await expect(form.error(field), `${label} "${value}"`).toHaveText(message)
        }
        await input.fill("Anne-Marie O'Sample")
        await form.next()
        await form.expectStep(2)
        await form.back()
      }
    })

    test('validates the email format', async ({ candidateFormPage: form }) => {
      await form.fillPersonal(buildCandidate())

      for (const value of ['plainaddress', 'missing@domain', '@example.com', 'two@@example.com', 'short@tld.c']) {
        await form.emailInput.fill(value)
        await form.next()
        await expect(form.error('email'), value).toHaveText(INVALID_EMAIL)
        await expect(form.emailInput).toHaveAttribute('aria-invalid', 'true')
      }
      await form.expectStep(1)
    })

    test('validates the phone format', async ({ candidateFormPage: form }) => {
      await form.fillPersonal(buildCandidate())

      for (const value of ['123456', 'call me', '0770x 900123', '1234567890123456', '07700+900123']) {
        await form.phoneInput.fill(value)
        await form.next()
        await expect(form.error('phone'), value).toHaveText(INVALID_PHONE)
      }

      for (const value of ['+44 (0)7700 900-123', '1234567', '123456789012345']) {
        await form.phoneInput.fill(value)
        await form.next()
        await form.expectStep(2)
        await form.back()
      }
    })

    test('validates the location length', async ({ candidateFormPage: form }) => {
      await form.fillPersonal(buildCandidate())

      for (const value of ['A', 'A'.repeat(101)]) {
        await form.locationInput.fill(value)
        await form.next()
        await expect(form.error('location')).toHaveText('Location must be between 2 and 100 characters')
      }
    })

    test('clears errors once the step is valid', async ({ candidateFormPage: form }) => {
      await form.next()
      await expect(form.errorSummary).toBeVisible()

      await form.fillPersonal(buildCandidate())
      await form.next()

      await form.expectStep(2)
      await expect(form.errorSummary).toBeHidden()
    })
  })

  test.describe('step 2: employment history', () => {
    test.beforeEach(async ({ candidateFormPage: form }) => {
      await form.completeSteps(buildCandidate(), 1)
    })

    test('requires the fields of each role', async ({ candidateFormPage: form }) => {
      await form.next()

      await expect(form.error('employmentHistory-0-company')).toHaveText('Company is required')
      await expect(form.error('employmentHistory-0-jobTitle')).toHaveText('Job title is required')
      await expect(form.error('employmentHistory-0-startDate')).toHaveText('Start date is required')
      await expect(form.error('employmentHistory-0-endDate')).toHaveText('End date is required unless this is a current role')
      await expect(form.errorSummaryItems).toHaveCount(4)
      await form.expectStep(2)
    })

    test('requires at least one role', async ({ candidateFormPage: form }) => {
      await form.removeRoleButton(0).click()
      await expect(form.roles).toHaveCount(0)
      await form.next()

      await expect(form.error('employmentHistory')).toHaveText('Add at least one role')
    })

    test('validates company and job title length', async ({ candidateFormPage: form }) => {
      await form.fillRole(0, buildRole({ company: 'A', jobTitle: 'B' }))
      await form.next()

      await expect(form.error('employmentHistory-0-company')).toHaveText('Company must be between 2 and 100 characters')
      await expect(form.error('employmentHistory-0-jobTitle')).toHaveText('Job title must be between 2 and 100 characters')
    })

    test('applies the date rules', async ({ candidateFormPage: form }) => {
      await form.fillRole(0, buildRole({ startDate: isoDate(1), current: true }))
      await form.next()
      await expect(form.error('employmentHistory-0-startDate')).toHaveText('Start date cannot be in the future')

      await form.roleField(0, 'I currently work here').uncheck()
      await form.roleField(0, 'Start date').fill(isoDate(-100))
      await form.roleField(0, 'End date').fill(isoDate(-200))
      await form.next()
      await expect(form.error('employmentHistory-0-endDate')).toHaveText('End date must be on or after the start date')

      await form.roleField(0, 'End date').fill(isoDate(1))
      await form.next()
      await expect(form.error('employmentHistory-0-endDate')).toHaveText('End date cannot be in the future')

      // Starting and ending on the same day, and ending today, are both allowed
      await form.roleField(0, 'Start date').fill(isoDate(0))
      await form.roleField(0, 'End date').fill(isoDate(0))
      await form.next()
      await form.expectStep(3)
    })

    test('a current role needs no end date', async ({ candidateFormPage: form }) => {
      await form.fillRole(0, buildRole({ current: false, endDate: isoDate(-30) }))
      await expect(form.roleField(0, 'End date')).toHaveValue(isoDate(-30))

      await form.roleField(0, 'I currently work here').check()
      await expect(form.roleField(0, 'End date')).toBeDisabled()
      await expect(form.roleField(0, 'End date')).toHaveValue('')

      await form.next()
      await form.expectStep(3)
    })

    test('roles can be added and removed', async ({ candidateFormPage: form }) => {
      await form.addRoleButton.click()
      await form.addRoleButton.click()
      await expect(form.roles).toHaveCount(3)
      await form.roleField(0, 'Company').fill('First Demo Co')
      await form.roleField(1, 'Company').fill('Second Demo Co')
      await form.roleField(2, 'Company').fill('Third Demo Co')

      await form.removeRoleButton(1).click()

      await expect(form.roles).toHaveCount(2)
      await expect(form.roleField(0, 'Company')).toHaveValue('First Demo Co')
      await expect(form.roleField(1, 'Company')).toHaveValue('Third Demo Co')
    })

    test('every role is validated separately', async ({ candidateFormPage: form }) => {
      await form.fillEmployment([buildRole(), buildRole({ company: '' })])
      await form.next()

      await expect(form.error('employmentHistory-1-company')).toHaveText('Company is required')
      await expect(form.error('employmentHistory-0-company')).toBeHidden()
      await expect(form.errorSummaryItems).toHaveCount(1)
    })

    test('allows at most ten roles', async ({ candidateFormPage: form }) => {
      for (let count = 1; count < 10; count++) await form.addRoleButton.click()

      await expect(form.roles).toHaveCount(10)
      await expect(form.addRoleButton).toBeDisabled()

      await form.removeRoleButton(9).click()
      await expect(form.addRoleButton).toBeEnabled()
    })
  })

  test.describe('step 3: skills and salary', () => {
    test.beforeEach(async ({ candidateFormPage: form }) => {
      await form.completeSteps(buildCandidate(), 2)
    })

    test('requires a skill and both salaries', async ({ candidateFormPage: form }) => {
      await form.next()

      await expect(form.error('skills')).toHaveText('Select at least one skill')
      await expect(form.error('salaryMin')).toHaveText('Minimum salary is required')
      await expect(form.error('salaryMax')).toHaveText('Maximum salary is required')
      await form.expectStep(3)
    })

    test('allows at most ten skills', async ({ candidateFormPage: form }) => {
      for (const name of SKILLS.slice(0, 11)) await form.skill(name).check()
      await form.salaryMinInput.fill('30000')
      await form.salaryMaxInput.fill('40000')
      await form.next()
      await expect(form.error('skills')).toHaveText('Select no more than 10 skills')

      await form.skill(SKILLS[0]).uncheck()
      await form.next()
      await form.expectStep(4)
    })

    test('salaries must be whole numbers in range', async ({ candidateFormPage: form }) => {
      await form.skill('SQL').check()
      const fields = [
        [form.salaryMinInput, 'salaryMin', 'Minimum salary'],
        [form.salaryMaxInput, 'salaryMax', 'Maximum salary']
      ]
      for (const [input, field, label] of fields) {
        const cases = [
          ['abc', `${label} must be a whole number`],
          ['30000.50', `${label} must be a whole number`],
          ['30,000', `${label} must be a whole number`],
          ['9999', `${label} must be ${SALARY_RANGE}`],
          ['500001', `${label} must be ${SALARY_RANGE}`],
          ['-30000', `${label} must be ${SALARY_RANGE}`]
        ]
        for (const [value, message] of cases) {
          await input.fill(value)
          await form.next()
          await expect(form.error(field), `${label} "${value}"`).toHaveText(message)
        }
        await input.fill('30000')
      }
    })

    test('maximum salary cannot be below minimum salary', async ({ candidateFormPage: form }) => {
      await form.skill('SQL').check()
      await form.salaryMinInput.fill('40000')
      await form.salaryMaxInput.fill('39999')
      await form.next()
      await expect(form.error('salaryMax')).toHaveText('Maximum salary must be greater than or equal to minimum salary')

      await form.salaryMaxInput.fill('40000')
      await form.next()
      await form.expectStep(4)
    })

    test('accepts the lowest and highest allowed salaries', async ({ candidateFormPage: form }) => {
      await form.skill('SQL').check()
      await form.salaryMinInput.fill('10000')
      await form.salaryMaxInput.fill('500000')
      await form.next()

      await form.expectStep(4)
    })
  })

  test.describe('step 4: right to work and availability', () => {
    test.beforeEach(async ({ candidateFormPage: form }) => {
      await form.completeSteps(buildCandidate(), 3)
    })

    test('requires right to work and availability', async ({ candidateFormPage: form }) => {
      await form.next()

      await expect(form.error('rightToWork')).toHaveText('Select a right to work option')
      await expect(form.error('availability')).toHaveText('Select an availability option')
      await expect(form.errorSummaryItems).toHaveCount(2)
      await form.expectStep(4)
    })

    test('shows visa fields only when a visa is required', async ({ candidateFormPage: form }) => {
      await expect(form.visaFields).toBeHidden()

      await form.rightToWorkOption('visa').check()
      await expect(form.visaTypeInput).toBeVisible()
      await expect(form.visaExpiryInput).toBeVisible()

      await form.rightToWorkOption('citizen').check()
      await expect(form.visaFields).toBeHidden()

      await form.rightToWorkOption('settled').check()
      await expect(form.visaFields).toBeHidden()
    })

    test('shows the availability field that matches the selected option', async ({ candidateFormPage: form }) => {
      await expect(form.noticeFields).toBeHidden()
      await expect(form.dateFields).toBeHidden()

      await form.availabilityOption('notice').check()
      await expect(form.noticePeriodInput).toBeVisible()
      await expect(form.dateFields).toBeHidden()

      await form.availabilityOption('date').check()
      await expect(form.availableFromInput).toBeVisible()
      await expect(form.noticeFields).toBeHidden()

      await form.availabilityOption('immediate').check()
      await expect(form.noticeFields).toBeHidden()
      await expect(form.dateFields).toBeHidden()
    })

    test('validates the visa fields', async ({ candidateFormPage: form }) => {
      await form.rightToWorkOption('visa').check()
      await form.availabilityOption('immediate').check()
      await form.next()
      await expect(form.error('visaType')).toHaveText('Visa type is required')
      await expect(form.error('visaExpiry')).toHaveText('Visa expiry date is required')

      await form.visaTypeInput.fill('X')
      await form.visaExpiryInput.fill(isoDate(-1))
      await form.next()
      await expect(form.error('visaType')).toHaveText('Visa type must be between 2 and 50 characters')
      await expect(form.error('visaExpiry')).toHaveText('Visa expiry date must be in the future')

      // A visa that expires today is not in the future
      await form.visaTypeInput.fill('Skilled Worker')
      await form.visaExpiryInput.fill(isoDate(0))
      await form.next()
      await expect(form.error('visaExpiry')).toHaveText('Visa expiry date must be in the future')
      await expect(form.error('visaType')).toBeHidden()

      await form.visaExpiryInput.fill(isoDate(1))
      await form.next()
      await form.expectStep(5)
    })

    test('validates the notice period', async ({ candidateFormPage: form }) => {
      await form.rightToWorkOption('citizen').check()
      await form.availabilityOption('notice').check()
      await form.next()
      await expect(form.error('noticePeriodWeeks')).toHaveText('Notice period is required')

      const cases = [
        ['two', 'Notice period must be a whole number of weeks'],
        ['2.5', 'Notice period must be a whole number of weeks'],
        ['0', 'Notice period must be between 1 and 26 weeks'],
        ['27', 'Notice period must be between 1 and 26 weeks']
      ]
      for (const [value, message] of cases) {
        await form.noticePeriodInput.fill(value)
        await form.next()
        await expect(form.error('noticePeriodWeeks'), value).toHaveText(message)
      }

      for (const value of ['1', '26']) {
        await form.noticePeriodInput.fill(value)
        await form.next()
        await form.expectStep(5)
        await form.back()
      }
    })

    test('validates the available from date', async ({ candidateFormPage: form }) => {
      await form.rightToWorkOption('settled').check()
      await form.availabilityOption('date').check()
      await form.next()
      await expect(form.error('availableFrom')).toHaveText('Available from date is required')

      await form.availableFromInput.fill(isoDate(-1))
      await form.next()
      await expect(form.error('availableFrom')).toHaveText('Available from date cannot be in the past')

      await form.availableFromInput.fill(isoDate(400))
      await form.next()
      await expect(form.error('availableFrom')).toHaveText('Available from date must be within the next 12 months')

      await form.availableFromInput.fill(isoDate(0))
      await form.next()
      await form.expectStep(5)
    })

    test('ignores conditional fields that are no longer shown', async ({ candidateFormPage: form }) => {
      await form.rightToWorkOption('visa').check()
      await form.visaExpiryInput.fill(isoDate(-10))
      await form.availabilityOption('notice').check()
      await form.noticePeriodInput.fill('99')

      await form.rightToWorkOption('citizen').check()
      await form.availabilityOption('immediate').check()
      await form.next()

      await form.expectStep(5)
      await expect(form.review('rightToWork')).toHaveText('UK or Irish citizen')
      await expect(form.review('availability')).toHaveText('Immediately')
      await expect(form.review('visaExpiry')).toHaveCount(0)
      await expect(form.review('noticePeriodWeeks')).toHaveCount(0)
    })
  })

  test.describe('navigation and review', () => {
    test('the progress indicator follows the current step', async ({ candidateFormPage: form }) => {
      await expect(form.progressText).toHaveText('Step 1 of 5: Personal details')
      await expect(form.progressStep(1)).toHaveAttribute('aria-current', 'step')
      await expect(form.progressBar).toHaveAttribute('value', '1')
      await expect(form.backButton).toBeHidden()
      await expect(form.submitButton).toBeHidden()

      await form.completeSteps(buildCandidate(), 2)

      await expect(form.progressText).toHaveText('Step 3 of 5: Skills and salary expectations')
      await expect(form.progressStep(1)).toHaveAttribute('data-state', 'complete')
      await expect(form.progressStep(2)).toHaveAttribute('data-state', 'complete')
      await expect(form.progressStep(3)).toHaveAttribute('aria-current', 'step')
      await expect(form.progressStep(4)).toHaveAttribute('data-state', 'upcoming')
      await expect(form.progressStep(1)).not.toHaveAttribute('aria-current', 'step')
      await expect(form.progressBar).toHaveAttribute('value', '3')
      await expect(form.backButton).toBeVisible()
    })

    test('the last step offers Submit instead of Next', async ({ candidateFormPage: form }) => {
      await form.completeSteps(buildCandidate())

      await expect(form.progressText).toHaveText('Step 5 of 5: Review and submit')
      await expect(form.submitButton).toBeVisible()
      await expect(form.nextButton).toBeHidden()
      await expect(form.saveDraftButton).toBeVisible()
    })

    test('Back and Next keep the data entered on every step', async ({ candidateFormPage: form }) => {
      const earlierRole = buildRole({ current: false, startDate: isoDate(-900), endDate: isoDate(-500) })
      const candidate = visaCandidate({ employmentHistory: [buildRole(), earlierRole] })
      await form.completeSteps(candidate)

      await form.back()
      await form.expectStep(4)
      await expect(form.rightToWorkOption('visa')).toBeChecked()
      await expect(form.visaTypeInput).toHaveValue(candidate.visaType)
      await expect(form.visaExpiryInput).toHaveValue(candidate.visaExpiry)
      await expect(form.availabilityOption('notice')).toBeChecked()
      await expect(form.noticePeriodInput).toHaveValue('4')
      await expect(form.relocateCheckbox).toBeChecked()

      await form.back()
      await form.expectStep(3)
      for (const name of SKILLS) {
        await expect(form.skill(name)).toBeChecked({ checked: candidate.skills.includes(name) })
      }
      await expect(form.salaryMinInput).toHaveValue(String(candidate.salaryMin))
      await expect(form.salaryMaxInput).toHaveValue(String(candidate.salaryMax))

      await form.back()
      await form.expectStep(2)
      await expect(form.roles).toHaveCount(2)
      await expect(form.roleField(0, 'Company')).toHaveValue(candidate.employmentHistory[0].company)
      await expect(form.roleField(0, 'I currently work here')).toBeChecked()
      await expect(form.roleField(1, 'Job title')).toHaveValue(earlierRole.jobTitle)
      await expect(form.roleField(1, 'Start date')).toHaveValue(earlierRole.startDate)
      await expect(form.roleField(1, 'End date')).toHaveValue(earlierRole.endDate)

      await form.back()
      await form.expectStep(1)
      await expect(form.firstNameInput).toHaveValue(candidate.firstName)
      await expect(form.lastNameInput).toHaveValue(candidate.lastName)
      await expect(form.emailInput).toHaveValue(candidate.email)
      await expect(form.phoneInput).toHaveValue(candidate.phone)
      await expect(form.locationInput).toHaveValue(candidate.location)

      // Going forward again needs no re-entry
      for (let step = 2; step <= 5; step++) {
        await form.next()
        await form.expectStep(step)
      }
      await expect(form.review('name')).toHaveText(fullName(candidate))
    })

    test('the review step summarises every section', async ({ candidateFormPage: form }) => {
      const candidate = visaCandidate()
      await form.completeSteps(candidate)

      await expect(form.review('name')).toHaveText(fullName(candidate))
      await expect(form.review('email')).toHaveText(candidate.email)
      await expect(form.review('phone')).toHaveText(candidate.phone)
      await expect(form.review('location')).toHaveText(candidate.location)
      await expect(form.review('role-0')).toContainText(candidate.employmentHistory[0].company)
      await expect(form.review('role-0')).toContainText('present')
      await expect(form.review('skills')).toHaveText(candidate.skills.join(', '))
      await expect(form.review('salary')).toHaveText(`£${candidate.salaryMin} – £${candidate.salaryMax}`)
      await expect(form.review('rightToWork')).toHaveText('Visa required')
      await expect(form.review('visaType')).toHaveText('Skilled Worker')
      await expect(form.review('availability')).toHaveText('After a notice period')
      await expect(form.review('noticePeriodWeeks')).toHaveText('4 weeks')
      await expect(form.review('willingToRelocate')).toHaveText('Yes')
    })

    test('Edit on the review step returns to that section', async ({ candidateFormPage: form }) => {
      await form.completeSteps(buildCandidate())

      await form.editSectionButton('Skills and salary').click()
      await form.expectStep(3)
      await form.salaryMaxInput.fill('123456')
      await form.next()
      await form.next()
      await form.expectStep(5)
      await expect(form.review('salary')).toContainText('£123456')

      await form.editSectionButton('Personal details').click()
      await form.expectStep(1)
      await form.locationInput.fill('Testville')
      for (let step = 2; step <= 5; step++) await form.next()
      await expect(form.review('location')).toHaveText('Testville')
    })

    test('submitting requires the confirmation checkbox', async ({ candidateFormPage: form, page }) => {
      await form.completeSteps(buildCandidate())
      await form.submitButton.click()

      await expect(form.error('confirm')).toHaveText('Confirm the details are correct before submitting')
      await expect(page).toHaveURL(/\/candidates\/new$/)
    })
  })

  test.describe('save as draft', () => {
    test('needs only a first and last name', async ({ candidateFormPage: form, candidateListPage, page }) => {
      const candidate = buildCandidate()
      await form.firstNameInput.fill(candidate.firstName)
      await form.lastNameInput.fill(candidate.lastName)
      await form.saveDraft()

      await form.toast.expectSuccess(`Draft saved for ${fullName(candidate)}`)
      await expect(page).toHaveURL(/\/candidates\/new\?draft=\d+$/)

      await candidateListPage.goto()
      await candidateListPage.search(fullName(candidate))
      expect(await candidateListPage.statuses()).toEqual(['Draft'])
    })

    test('requires the name', async ({ candidateFormPage: form, page }) => {
      await form.saveDraft()

      await expect(form.error('firstName')).toHaveText('First name is required')
      await expect(form.error('lastName')).toHaveText('Last name is required')
      await expect(form.errorSummaryItems).toHaveCount(2)
      await expect(page).toHaveURL(/\/candidates\/new$/)
    })

    test('still checks the format of anything filled in', async ({ candidateFormPage: form }) => {
      const candidate = buildCandidate({ email: 'not-an-email', phone: '123' })
      await form.fillPersonal(candidate)
      await form.saveDraft()

      await expect(form.error('email')).toHaveText(INVALID_EMAIL)
      await expect(form.error('phone')).toHaveText(INVALID_PHONE)
      await expect(form.toast.root).toBeHidden()
    })

    test('from a later step, jumps back to the step with the problem', async ({ candidateFormPage: form }) => {
      await form.completeSteps(buildCandidate(), 2)
      await form.salaryMinInput.fill('5')
      await form.back()
      await form.back()
      await form.expectStep(1)

      await form.saveDraft()

      await form.expectStep(3)
      await expect(form.error('salaryMin')).toHaveText(`Minimum salary must be ${SALARY_RANGE}`)
    })

    test('a saved draft reopens with its data and can be saved again', async ({ candidateFormPage: form, page }) => {
      const candidate = visaCandidate()
      await form.completeSteps(candidate, 3)
      await form.saveDraft()
      await form.toast.expectSuccess(`Draft saved for ${fullName(candidate)}`)

      await page.reload()
      await form.expectStep(1)
      await expect(form.heading).toHaveText(`Continue draft: ${fullName(candidate)}`)
      await expect(form.emailInput).toHaveValue(candidate.email)
      await form.next()
      await expect(form.roleField(0, 'Company')).toHaveValue(candidate.employmentHistory[0].company)
      await form.next()
      await expect(form.salaryMinInput).toHaveValue(String(candidate.salaryMin))
      for (const name of candidate.skills) await expect(form.skill(name)).toBeChecked()

      const draftUrl = page.url()
      await form.salaryMaxInput.fill('499999')
      await form.saveDraft()
      await form.toast.expectSuccess(`Draft saved for ${fullName(candidate)}`)
      expect(page.url()).toBe(draftUrl)
    })

    test('a draft created elsewhere can be completed and submitted', async ({ api, candidateFormPage: form, candidateProfilePage, page }) => {
      const candidate = buildCandidate()
      const draft = await api.createDraft({ firstName: candidate.firstName, lastName: candidate.lastName })

      await candidateProfilePage.goto(draft.id)
      await expect(candidateProfilePage.status).toHaveText('Draft')
      await expect(candidateProfilePage.draftBanner).toBeVisible()
      await candidateProfilePage.continueDraftLink.click()
      await form.expectStep(1)
      await expect(form.firstNameInput).toHaveValue(candidate.firstName)

      await form.createCandidate(candidate)

      await expect(page).toHaveURL(new RegExp(`/candidates/${draft.id}$`))
      await expect(candidateProfilePage.status).toHaveText('Active')
      await expect(candidateProfilePage.draftBanner).toBeHidden()
      await candidateProfilePage.expectStatusHistory(['Active', 'Draft'])
    })
  })

  test.describe('submitting', () => {
    test('creates the candidate and shows every detail on the profile', async ({ candidateFormPage: form, candidateProfilePage: profile }) => {
      const earlierRole = buildRole({ current: false, startDate: isoDate(-900), endDate: isoDate(-500) })
      const candidate = visaCandidate({ employmentHistory: [buildRole(), earlierRole] })
      await form.createCandidate(candidate)

      await profile.toast.expectSuccess('Candidate submitted')
      await expect(profile.name).toHaveText(fullName(candidate))
      await expect(profile.status).toHaveText('Active')
      await expect(profile.detail('email')).toHaveText(candidate.email)
      await expect(profile.detail('phone')).toHaveText(candidate.phone)
      await expect(profile.detail('location')).toHaveText(candidate.location)
      await expect(profile.detail('skills')).toHaveText(candidate.skills.join(', '))
      await expect(profile.detail('salary')).toHaveText(`${money(candidate.salaryMin)} – ${money(candidate.salaryMax)}`)
      await expect(profile.detail('rightToWork')).toHaveText('Visa required')
      await expect(profile.detail('visaType')).toHaveText('Skilled Worker')
      await expect(profile.detail('availability')).toHaveText("After 4 weeks' notice")
      await expect(profile.detail('willingToRelocate')).toHaveText('Yes')
      await expect(profile.employmentItems).toHaveCount(2)
      await expect(profile.employmentItems.first()).toContainText(candidate.employmentHistory[0].company)
      await profile.expectStatusHistory(['Active'])
    })

    test('a candidate available from a date is saved with that date', async ({ candidateFormPage: form, candidateProfilePage: profile, api, page }) => {
      const candidate = buildCandidate({ rightToWork: 'settled', availability: 'date', availableFrom: isoDate(30) })
      await form.createCandidate(candidate)

      await expect(profile.detail('rightToWork')).toHaveText('Settled or pre-settled status')
      await expect(profile.detail('availability')).toContainText('From ')
      const saved = await api.getCandidate(page.url().split('/').pop())
      expect(saved.availableFrom).toBe(candidate.availableFrom)
      expect(saved.noticePeriodWeeks).toBeNull()
    })

    test('an email that is already in use is reported on step 1', async ({ candidateFormPage: form, page }) => {
      const candidate = buildCandidate({ email: 'amara.demoray@example.com' })
      await form.completeSteps(candidate)
      await form.submit()

      await form.expectStep(1)
      await expect(form.error('email')).toHaveText('A candidate with this email already exists')
      await expect(page).toHaveURL(/\/candidates\/new$/)
    })
  })
})
