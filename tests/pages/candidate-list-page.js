const { Table } = require('../components/table')
const { Toast } = require('../components/toast')

class CandidateListPage {
  constructor(page) {
    this.page = page
    this.toast = new Toast(page)
    this.heading = page.getByRole('heading', { name: 'Candidates', level: 1 })
    this.addCandidateLink = page.getByRole('link', { name: 'Add candidate' })

    this.filters = page.getByRole('search', { name: 'Filter candidates' })
    this.searchInput = this.filters.getByLabel('Search by name')
    this.statusFilter = this.filters.getByLabel('Status')
    this.skillFilter = this.filters.getByLabel('Skill')
    this.searchButton = this.filters.getByRole('button', { name: 'Search' })
    this.clearButton = this.filters.getByRole('button', { name: 'Clear' })

    this.resultCount = page.getByTestId('candidate-result-count')
    this.emptyMessage = page.getByTestId('candidates-empty')
    this.table = new Table(page.getByTestId('candidates-table'), 'candidate-row')

    this.pagination = page.getByRole('navigation', { name: 'Pagination' })
    this.previousButton = this.pagination.getByRole('button', { name: 'Previous' })
    this.nextButton = this.pagination.getByRole('button', { name: 'Next' })
    this.pageInfo = page.getByTestId('pagination-info')
  }

  // query is an optional string such as '?status=Active&page=2'
  async goto(query = '') {
    await this.page.goto(`/candidates${query}`)
    await this.table.waitUntilLoaded()
  }

  async search(name) {
    await this.searchInput.fill(name)
    await this.searchButton.click()
    await this.table.waitUntilLoaded()
  }

  async filterByStatus(status) {
    await this.statusFilter.selectOption(status)
    await this.table.waitUntilLoaded()
  }

  async filterBySkill(skill) {
    await this.skillFilter.selectOption(skill)
    await this.table.waitUntilLoaded()
  }

  async clearFilters() {
    await this.clearButton.click()
    await this.table.waitUntilLoaded()
  }

  pageButton(number) {
    return this.pagination.getByRole('button', { name: `Page ${number}`, exact: true })
  }

  async goToPage(number) {
    await this.pageButton(number).click()
    await this.table.waitUntilLoaded()
  }

  async goToNextPage() {
    await this.nextButton.click()
    await this.table.waitUntilLoaded()
  }

  async goToPreviousPage() {
    await this.previousButton.click()
    await this.table.waitUntilLoaded()
  }

  names() {
    return this.table.cellTexts('candidate-name-link')
  }

  statuses() {
    return this.table.cellTexts('candidate-status')
  }

  candidateLink(name) {
    return this.table.root.getByRole('link', { name, exact: true })
  }

  async openCandidate(name) {
    await this.candidateLink(name).click()
  }
}

module.exports = { CandidateListPage }
