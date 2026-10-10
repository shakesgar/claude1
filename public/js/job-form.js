(async () => {
  await App.init('jobs')
  const { $, esc, api } = App
  const FIELDS = ['title', 'client', 'location', 'status', 'salaryMin', 'salaryMax', 'description']
  const form = $('#job-form')
  const summary = $('#error-summary')
  const saveButton = $('[data-testid="job-save-button"]')

  // /jobs/new creates a job, /jobs/:id/edit updates one
  const match = location.pathname.match(/^\/jobs\/(\d+)\/edit$/)
  const jobId = match ? match[1] : null

  function showNotFound() {
    $('#content').hidden = true
    $('#not-found').hidden = false
  }

  function showFormErrors(errors) {
    App.showErrors(form, errors)
    const items = Object.values(errors).map(message => `<li data-testid="error-summary-item">${esc(message)}</li>`).join('')
    const count = Object.keys(errors).length
    summary.innerHTML = `<strong>There ${count === 1 ? 'is 1 problem' : `are ${count} problems`} with this job</strong><ul>${items}</ul>`
    summary.hidden = false
    summary.focus()
  }

  App.fillSelect(form.elements.status, Validators.JOB_STATUSES, '')

  if (!jobId && location.pathname !== '/jobs/new') return showNotFound()
  if (jobId) {
    const res = await api('GET', `/api/jobs/${jobId}`)
    if (!res.ok) return showNotFound()
    for (const name of FIELDS) form.elements[name].value = res.data[name] ?? ''
    $('#form-title').textContent = `Edit job: ${res.data.title}`
    $('#cancel-link').href = `/jobs/${jobId}`
    document.title = 'Edit job – Recruit Demo CRM'
  } else {
    document.title = 'Create job – Recruit Demo CRM'
  }

  form.addEventListener('submit', async e => {
    e.preventDefault()
    const data = Object.fromEntries(FIELDS.map(name => [name, form.elements[name].value.trim()]))
    const errors = Validators.validateJob(data)
    if (Object.keys(errors).length) return showFormErrors(errors)
    App.clearErrors(form)
    summary.hidden = true

    saveButton.disabled = true
    const res = jobId ? await api('PUT', `/api/jobs/${jobId}`, data) : await api('POST', '/api/jobs', data)
    saveButton.disabled = false
    if (res.ok) {
      App.flashNext(jobId ? 'Job updated' : 'Job created')
      location.href = `/jobs/${res.data.id}`
    } else if (res.data && res.data.errors) {
      showFormErrors(res.data.errors)
    } else {
      App.flash(App.errorMessage(res), 'error')
    }
  })
})()
