const { expect } = require('@playwright/test')

// The message banner shown after an action succeeds or fails
class Toast {
  constructor(page) {
    this.root = page.getByTestId('flash-message')
  }

  async expectSuccess(text) {
    await expect(this.root).toHaveText(text)
    await expect(this.root).toHaveAttribute('data-flash-type', 'success')
  }

  async expectError(text) {
    await expect(this.root).toHaveText(text)
    await expect(this.root).toHaveAttribute('data-flash-type', 'error')
  }
}

module.exports = { Toast }
