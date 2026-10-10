(async () => {
  const user = await App.init('jobs')
  const { $, esc, api } = App
  const id = encodeURIComponent(location.pathname.split('/')[2])
  let job = null

  function renderJob() {
    document.title = `${job.title} – Recruit Demo CRM`
    $('#job-title').textContent = job.title
    $('#status-badge').innerHTML = App.badge(job.status, 'job-status')
    $('#edit-link').href = `/jobs/${job.id}/edit`
    $('#pipeline-link').href = `/pipeline?jobId=${job.id}`
    $('#delete-job').hidden = user.role !== 'admin'
    $('#assign-form').hidden = job.status !== 'Open'
    $('#assign-closed').hidden = job.status === 'Open'

    const item = (key, label, text) => `<div><dt>${label}</dt><dd data-testid="detail-${key}">${esc(text) || '—'}</dd></div>`
    $('#details').innerHTML = [
      item('client', 'Client', job.client),
      item('location', 'Location', job.location),
      item('salary', 'Salary range', App.salaryRange(job.salaryMin, job.salaryMax)),
      item('createdAt', 'Created', App.date(job.createdAt)),
      item('description', 'Description', job.description)
    ].join('')
  }

  async function loadApplications() {
    const [appsRes, candidatesRes] = await Promise.all([
      api('GET', `/api/pipeline?jobId=${id}`),
      api('GET', '/api/candidates?pageSize=100')
    ])
    if (!appsRes.ok || !candidatesRes.ok) return
    const applications = appsRes.data.data
    $('#applications').innerHTML = applications.map(a => `
      <tr data-testid="job-candidate-row" data-application-id="${a.id}">
        <th scope="row"><a href="/candidates/${a.candidateId}" data-testid="job-candidate-link">${esc(a.candidateName)}</a></th>
        <td>${App.badge(a.stage, 'job-candidate-stage')}</td>
        <td data-testid="job-candidate-updated">${App.dateTime(a.updatedAt)}</td>
      </tr>`).join('')
    $('#candidate-count').textContent = applications.length
    $('#applications-empty').hidden = applications.length > 0

    // Offer submitted candidates who are not already on this job
    const assigned = new Set(applications.map(a => a.candidateId))
    const options = candidatesRes.data.data
      .filter(c => c.status !== 'Draft' && !assigned.has(c.id))
      .map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName} (${c.status})` }))
    App.fillSelect($('#assign-candidate'), options, '')
  }

  $('#assign-form').addEventListener('submit', async e => {
    e.preventDefault()
    const form = e.target
    const candidateId = form.elements.candidateId.value
    if (!candidateId) return App.showErrors(form, { candidateId: 'Select a candidate to assign' })
    App.clearErrors(form)
    const res = await api('POST', '/api/pipeline', { candidateId: Number(candidateId), jobId: job.id })
    if (res.ok) {
      await loadApplications()
      App.flash(`${res.data.candidateName} assigned at the Applied stage`)
    } else if (res.data && res.data.errors) {
      App.showErrors(form, res.data.errors)
    } else {
      App.showErrors(form, { candidateId: App.errorMessage(res) })
    }
  })

  $('#delete-job').addEventListener('click', async () => {
    const confirmed = await App.confirmDialog({
      title: 'Delete job',
      message: `Delete ${job.title}? Its candidate assignments will also be removed.`,
      confirmLabel: 'Delete'
    })
    if (!confirmed) return
    const res = await api('DELETE', `/api/jobs/${id}`)
    if (!res.ok) return App.flash(App.errorMessage(res), 'error')
    App.flashNext(`${job.title} was deleted`)
    location.href = '/jobs'
  })

  const res = await api('GET', `/api/jobs/${id}`)
  if (!res.ok) {
    $('#not-found').hidden = false
    return
  }
  job = res.data
  renderJob()
  $('#content').hidden = false
  await loadApplications()
})()
