const { expect } = require('@playwright/test')
const { Toast } = require('../components/toast')
const { RIGHT_TO_WORK_LABELS, AVAILABILITY_LABELS } = require('../data/constants')

const STEP_COUNT = 5

// The five-step candidate intake form at /candidates/new
class CandidateFormPage {
  constructor(page) {
    this.page = page
    this.toast = new Toast(page)
    this.heading = page.getByRole('heading', { level: 1 })
    this.progressText = page.getByTestId('progress-text')
    this.progressBar = page.getByRole('progressbar', { name: 'Form progress' })
    this.errorSummary = page.getByTestId('error-summary')
    this.errorSummaryItems = page.getByTestId('error-summary-item')

    this.backButton = page.getByRole('button', { name: 'Back', exact: true })
    this.nextButton = page.getByRole('button', { name: 'Next', exact: true })
    this.saveDraftButton = page.getByRole('button', { name: 'Save as draft' })
    this.submitButton = page.getByRole('button', { name: 'Submit candidate' })

    // Step 1
    this.firstNameInput = page.getByLabel('First name')
    this.lastNameInput = page.getByLabel('Last name')
    this.emailInput = page.getByLabel('Email')
    this.phoneInput = page.getByLabel('Phone')
    this.locationInput = page.getByLabel('Location')

    // Step 2
    this.addRoleButton = page.getByRole('button', { name: 'Add another role' })
    this.roles = page.getByRole('group', { name: /^Role \d+$/ })

    // Step 3
    this.salaryMinInput = page.getByLabel('Minimum expected salary')
    this.salaryMaxInput = page.getByLabel('Maximum expected salary')

    // Step 4
    this.visaFields = page.getByTestId('visa-fields')
    this.visaTypeInput = page.getByLabel('Visa type')
    this.visaExpiryInput = page.getByLabel('Visa expiry date')
    this.noticeFields = page.getByTestId('notice-fields')
    this.noticePeriodInput = page.getByLabel('Notice period (weeks)')
    this.dateFields = page.getByTestId('date-fields')
    this.availableFromInput = page.getByLabel('Available from')
    this.relocateCheckbox = page.getByLabel('Willing to relocate')

    // Step 5
    this.reviewSummary = page.getByTestId('review-summary')
    this.confirmCheckbox = page.getByLabel('I confirm these details are correct')
  }

  async goto() {
    await this.page.goto('/candidates/new')
    await this.expectStep(1)
  }

  async gotoDraft(id) {
    await this.page.goto(`/candidates/new?draft=${id}`)
    await this.expectStep(1)
  }

  // The progress text is the last thing the page sets, so it also signals the form is ready
  async expectStep(number) {
    await expect(this.progressText).toContainText(`Step ${number} of ${STEP_COUNT}`)
  }

  progressStep(number) {
    return this.page.getByTestId(`progress-step-${number}`)
  }

  // Inline error for a field, e.g. error('email') or error('employmentHistory-0-endDate')
  error(field) {
    return this.page.getByTestId(`error-${field}`)
  }

  role(index) {
    return this.page.getByRole('group', { name: `Role ${index + 1}`, exact: true })
  }

  roleField(index, label) {
    return this.role(index).getByLabel(label)
  }

  removeRoleButton(index) {
    return this.role(index).getByRole('button', { name: 'Remove role' })
  }

  skill(name) {
    return this.page.getByRole('checkbox', { name, exact: true })
  }

  rightToWorkOption(value) {
    return this.page.getByRole('radio', { name: RIGHT_TO_WORK_LABELS[value] })
  }

  availabilityOption(value) {
    return this.page.getByRole('radio', { name: AVAILABILITY_LABELS[value] })
  }

  // A value on the review step, e.g. review('email')
  review(key) {
    return this.page.getByTestId(`review-${key}`)
  }

  editSectionButton(sectionTitle) {
    return this.page.getByRole('button', { name: `Edit ${sectionTitle.toLowerCase()}` })
  }

  async next() {
    await this.nextButton.click()
  }

  async back() {
    await this.backButton.click()
  }

  async fillPersonal(candidate) {
    await this.firstNameInput.fill(candidate.firstName)
    await this.lastNameInput.fill(candidate.lastName)
    await this.emailInput.fill(candidate.email)
    await this.phoneInput.fill(candidate.phone)
    await this.locationInput.fill(candidate.location)
  }

  async fillRole(index, role) {
    await this.roleField(index, 'Company').fill(role.company)
    await this.roleField(index, 'Job title').fill(role.jobTitle)
    await this.roleField(index, 'Start date').fill(role.startDate)
    if (role.current) await this.roleField(index, 'I currently work here').check()
    else await this.roleField(index, 'End date').fill(role.endDate)
  }

  // The form starts with one empty role
  async fillEmployment(roles) {
    for (let i = 0; i < roles.length; i++) {
      if (i > 0) await this.addRoleButton.click()
      await this.fillRole(i, roles[i])
    }
  }

  async fillSkillsAndSalary(candidate) {
    for (const name of candidate.skills) await this.skill(name).check()
    await this.salaryMinInput.fill(String(candidate.salaryMin))
    await this.salaryMaxInput.fill(String(candidate.salaryMax))
  }

  async fillRightToWork(candidate) {
    await this.rightToWorkOption(candidate.rightToWork).check()
    if (candidate.rightToWork === 'visa') {
      await this.visaTypeInput.fill(candidate.visaType)
      await this.visaExpiryInput.fill(candidate.visaExpiry)
    }
    await this.availabilityOption(candidate.availability).check()
    if (candidate.availability === 'notice') await this.noticePeriodInput.fill(String(candidate.noticePeriodWeeks))
    if (candidate.availability === 'date') await this.availableFromInput.fill(candidate.availableFrom)
    if (candidate.willingToRelocate) await this.relocateCheckbox.check()
  }

  // Fills steps 1..lastStep and moves past each one, ending on step lastStep + 1
  async completeSteps(candidate, lastStep = 4) {
    const fillers = [
      () => this.fillPersonal(candidate),
      () => this.fillEmployment(candidate.employmentHistory),
      () => this.fillSkillsAndSalary(candidate),
      () => this.fillRightToWork(candidate)
    ]
    for (let step = 1; step <= lastStep; step++) {
      await fillers[step - 1]()
      await this.next()
      await this.expectStep(step + 1)
    }
  }

  async submit() {
    await this.confirmCheckbox.check()
    await this.submitButton.click()
  }

  // Fills every step and submits; the app then opens the new candidate's profile
  async createCandidate(candidate) {
    await this.completeSteps(candidate)
    await this.submit()
    await this.page.waitForURL(/\/candidates\/\d+$/)
  }

  async saveDraft() {
    await this.saveDraftButton.click()
  }
}

module.exports = { CandidateFormPage }
