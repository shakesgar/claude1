const { expect } = require('@playwright/test')
const { Table } = require('../components/table')
const { Toast } = require('../components/toast')

// Covers the jobs list (/jobs), the job form (/jobs/new, /jobs/:id/edit) and the job detail page (/jobs/:id)
class JobsPage {
  constructor(page) {
    this.page = page
    this.toast = new Toast(page)

    // List
    this.createJobLink = page.getByRole('link', { name: 'Create job' })
    this.filters = page.getByRole('search', { name: 'Filter jobs' })
    this.searchInput = this.filters.getByLabel('Search by title or client')
    this.statusFilter = this.filters.getByLabel('Status')
    this.searchButton = this.filters.getByRole('button', { name: 'Search' })
    this.resultCount = page.getByTestId('job-result-count')
    this.table = new Table(page.getByTestId('jobs-table'), 'job-row')

    // Form
    this.form = page.getByTestId('job-form')
    this.titleInput = this.form.getByLabel('Job title')
    this.clientInput = this.form.getByLabel('Client')
    this.locationInput = this.form.getByLabel('Location')
    this.statusSelect = this.form.getByLabel('Status')
    this.salaryMinInput = this.form.getByLabel('Minimum salary')
    this.salaryMaxInput = this.form.getByLabel('Maximum salary')
    this.descriptionInput = this.form.getByLabel('Description')
    this.saveButton = this.form.getByRole('button', { name: 'Save job' })
    this.errorSummaryItems = page.getByTestId('error-summary-item')

    // Detail
    this.title = page.getByRole('heading', { level: 1 })
    this.status = page.getByTestId('job-status')
    this.editLink = page.getByRole('link', { name: 'Edit job' })
    this.candidates = new Table(page.getByTestId('job-candidates-table'), 'job-candidate-row')
    this.assignCandidateSelect = page.getByLabel('Assign a candidate')
    this.assignButton = page.getByRole('button', { name: 'Assign', exact: true })
    this.assignUnavailableMessage = page.getByTestId('assign-unavailable')
  }

  async goto() {
    await this.page.goto('/jobs')
    await this.table.waitUntilLoaded()
  }

  async gotoNew() {
    await this.page.goto('/jobs/new')
    // The status options are added when the form is ready to use
    await expect(this.statusSelect.getByRole('option', { name: 'Open' })).toBeAttached()
  }

  async gotoDetail(id) {
    await this.page.goto(`/jobs/${id}`)
  }

  async search(text) {
    await this.searchInput.fill(text)
    await this.searchButton.click()
    await this.table.waitUntilLoaded()
  }

  async filterByStatus(status) {
    await this.statusFilter.selectOption(status)
    await this.table.waitUntilLoaded()
  }

  error(field) {
    return this.page.getByTestId(`error-${field}`)
  }

  detail(key) {
    return this.page.getByTestId(`detail-${key}`)
  }

  async fillForm(job) {
    await this.titleInput.fill(job.title)
    await this.clientInput.fill(job.client)
    await this.locationInput.fill(job.location)
    await this.statusSelect.selectOption(job.status)
    await this.salaryMinInput.fill(String(job.salaryMin))
    await this.salaryMaxInput.fill(String(job.salaryMax))
    await this.descriptionInput.fill(job.description)
  }

  // Fills and saves the form; the app then opens the job's detail page
  async createJob(job) {
    await this.gotoNew()
    await this.fillForm(job)
    await this.saveButton.click()
    await this.page.waitForURL(/\/jobs\/\d+$/)
  }

  async assignCandidate(candidateLabel) {
    await this.assignCandidateSelect.selectOption({ label: candidateLabel })
    await this.assignButton.click()
  }
}

module.exports = { JobsPage }
