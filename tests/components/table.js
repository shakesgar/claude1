const { expect } = require('@playwright/test')

// A data table whose body rows share one test id, such as 'candidate-row'
class Table {
  constructor(root, rowTestId) {
    this.root = root
    this.rows = root.getByTestId(rowTestId)
  }

  // The app sets aria-busy while it fetches rows
  async waitUntilLoaded() {
    await expect(this.root).toHaveAttribute('aria-busy', 'false')
  }

  header(name) {
    return this.root.getByRole('columnheader', { name, exact: true })
  }

  async sortBy(name) {
    await this.header(name).getByRole('button').click()
    await this.waitUntilLoaded()
  }

  row(text) {
    return this.rows.filter({ hasText: text })
  }

  // Text of one cell from every row, by the cell's test id
  cellTexts(cellTestId) {
    return this.rows.getByTestId(cellTestId).allTextContents()
  }
}

module.exports = { Table }
