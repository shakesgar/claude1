const { expect } = require('@playwright/test')

// The in-page confirmation dialog used for deletes, status changes and stage changes
class ConfirmDialog {
  constructor(page) {
    this.root = page.getByRole('dialog')
    this.title = this.root.getByRole('heading')
    this.message = this.root.getByTestId('confirm-message')
    this.acceptButton = this.root.getByTestId('confirm-accept')
    this.cancelButton = this.root.getByRole('button', { name: 'Cancel' })
  }

  async accept() {
    await this.acceptButton.click()
    await expect(this.root).toBeHidden()
  }

  async cancel() {
    await this.cancelButton.click()
    await expect(this.root).toBeHidden()
  }
}

module.exports = { ConfirmDialog }
