// The header shown on every signed-in page
class NavBar {
  constructor(page) {
    this.page = page
    this.root = page.getByRole('navigation', { name: 'Main' })
    this.userName = page.getByTestId('current-user-name')
    this.userRole = page.getByTestId('current-user-role')
    this.logoutButton = page.getByRole('button', { name: 'Log out' })
  }

  link(name) {
    return this.root.getByRole('link', { name, exact: true })
  }

  async goTo(name) {
    await this.link(name).click()
  }

  async logout() {
    await this.logoutButton.click()
  }
}

module.exports = { NavBar }
