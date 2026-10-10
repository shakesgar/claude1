(async () => {
  await App.init('jobs')
  const { $, esc, api } = App
  const form = $('#filters')
  const table = $('#jobs-table')

  App.fillSelect(form.elements.status, Validators.JOB_STATUSES)

  async function load() {
    const p = new URLSearchParams()
    if (form.elements.search.value.trim()) p.set('search', form.elements.search.value.trim())
    if (form.elements.status.value) p.set('status', form.elements.status.value)

    table.setAttribute('aria-busy', 'true')
    const res = await api('GET', `/api/jobs?${p}`)
    table.setAttribute('aria-busy', 'false')
    if (!res.ok) return App.flash(App.errorMessage(res), 'error')

    const { data, total } = res.data
    $('#rows').innerHTML = data.map(job => `
      <tr data-testid="job-row" data-job-id="${job.id}">
        <th scope="row"><a href="/jobs/${job.id}" data-testid="job-title-link">${esc(job.title)}</a></th>
        <td data-testid="job-client">${esc(job.client)}</td>
        <td data-testid="job-location">${esc(job.location) || '—'}</td>
        <td data-testid="job-salary">${App.salaryRange(job.salaryMin, job.salaryMax)}</td>
        <td>${App.badge(job.status, 'job-status')}</td>
        <td data-testid="job-candidate-count">${job.applicationCount}</td>
        <td><a href="/jobs/${job.id}/edit" data-testid="job-edit-link" aria-label="Edit ${esc(job.title)}">Edit</a></td>
      </tr>`).join('')
    $('#empty').hidden = total > 0
    $('#result-count').textContent = `${total} job${total === 1 ? '' : 's'}`
  }

  form.addEventListener('submit', e => {
    e.preventDefault()
    load()
  })
  form.elements.status.addEventListener('change', load)
  $('#clear-filters').addEventListener('click', () => {
    form.reset()
    load()
  })

  load()
})()
