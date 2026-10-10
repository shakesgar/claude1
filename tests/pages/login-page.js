class LoginPage {
  constructor(page) {
    this.page = page
    this.emailInput = page.getByLabel('Email')
    this.passwordInput = page.getByLabel('Password')
    this.submitButton = page.getByRole('button', { name: 'Log in' })
    this.error = page.getByTestId('login-error')
    this.emailError = page.getByTestId('login-email-error')
    this.passwordError = page.getByTestId('login-password-error')
  }

  async goto() {
    await this.page.goto('/login')
  }

  async login(email, password) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }

  async loginAs(user) {
    await this.login(user.email, user.password)
  }
}

module.exports = { LoginPage }
