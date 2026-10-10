(() => {
  const form = App.$('#login-form')
  const alertBox = App.$('#login-error')
  const submit = App.$('[data-testid="login-submit"]')

  // Only follow same-site paths, never an absolute or protocol-relative URL
  function nextUrl() {
    const next = new URLSearchParams(location.search).get('next') || ''
    return /^\/(?![/\\])/.test(next) ? next : '/candidates'
  }

  form.addEventListener('submit', async e => {
    e.preventDefault()
    alertBox.hidden = true
    const data = { email: form.elements.email.value.trim(), password: form.elements.password.value }
    const errors = Validators.validateLogin(data)
    if (Object.keys(errors).length) {
      App.showErrors(form, errors)
      return
    }
    App.clearErrors(form)

    submit.disabled = true
    const res = await App.api('POST', '/api/auth/login', data)
    submit.disabled = false
    if (res.ok) {
      location.href = nextUrl()
    } else if (res.data && res.data.errors) {
      App.showErrors(form, res.data.errors)
    } else {
      alertBox.textContent = App.errorMessage(res)
      alertBox.hidden = false
    }
  })
})()
