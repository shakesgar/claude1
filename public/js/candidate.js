(async () => {
  const user = await App.init('candidates')
  const { $, esc, api } = App
  const V = Validators
  const id = encodeURIComponent(location.pathname.split('/')[2])
  const base = `/api/candidates/${id}`
  const hasErrors = errors => Object.keys(errors).length > 0

  let candidate = null
  let notes = []
  let applications = []
  let editingNoteId = null

  // --- Candidate details ---

  function availabilityText(c) {
    if (c.availability === 'notice') return `After ${c.noticePeriodWeeks} weeks' notice`
    if (c.availability === 'date') return `From ${App.date(c.availableFrom)}`
    return c.availability === 'immediate' ? 'Immediately' : ''
  }

  function renderCandidate() {
    const c = candidate
    const name = `${c.firstName} ${c.lastName}`
    const draft = c.status === 'Draft'
    document.title = `${name} – Recruit Demo CRM`
    $('#candidate-name').textContent = name
    $('#status-badge').innerHTML = App.badge(c.status, 'candidate-status')
    $('#draft-banner').hidden = !draft
    $('#continue-draft').href = `/candidates/new?draft=${c.id}`
    $('#delete-candidate').hidden = user.role !== 'admin'
    $('#status-form').hidden = draft
    $('#assign-form').hidden = draft

    const item = (key, label, text) => `<div><dt>${label}</dt><dd data-testid="detail-${key}">${esc(text) || '—'}</dd></div>`
    $('#details').innerHTML = [
      item('email', 'Email', c.email),
      item('phone', 'Phone', c.phone),
      item('location', 'Location', c.location),
      item('skills', 'Skills', c.skills.join(', ')),
      item('salary', 'Expected salary', c.salaryMin == null && c.salaryMax == null ? '' : App.salaryRange(c.salaryMin, c.salaryMax)),
      item('rightToWork', 'Right to work', V.RIGHT_TO_WORK_LABELS[c.rightToWork] || ''),
      c.rightToWork === 'visa' ? item('visaType', 'Visa type', c.visaType) : '',
      c.rightToWork === 'visa' ? item('visaExpiry', 'Visa expiry date', c.visaExpiry && App.date(c.visaExpiry)) : '',
      item('availability', 'Availability', availabilityText(c)),
      item('willingToRelocate', 'Willing to relocate', c.willingToRelocate ? 'Yes' : 'No'),
      item('createdAt', 'Added', App.date(c.createdAt))
    ].join('')

    $('#employment').innerHTML = c.employmentHistory.map(r => `
      <li data-testid="employment-item">
        <strong data-testid="employment-title">${esc(r.jobTitle) || '—'}</strong> at <span data-testid="employment-company">${esc(r.company) || '—'}</span>
        <p class="meta" data-testid="employment-dates">${App.date(r.startDate)} to ${r.current ? 'present' : App.date(r.endDate)}</p>
      </li>`).join('') || '<li class="empty" data-testid="employment-empty">No employment history recorded.</li>'

    $('#cv-current').innerHTML = c.cv
      ? `<p><a href="${base}/cv" data-testid="cv-download-link">${esc(c.cv.filename)}</a>
           <span class="muted" data-testid="cv-meta">(${App.fileSize(c.cv.size)}, uploaded ${App.dateTime(c.cv.uploadedAt)} by ${esc(c.cv.uploadedBy)})</span>
           <button type="button" class="danger small" id="cv-remove" data-testid="cv-remove-button">Remove CV</button></p>`
      : '<p class="muted" data-testid="cv-empty">No CV uploaded.</p>'

    App.fillSelect($('#status-select'), V.CANDIDATE_STATUSES.filter(s => s !== 'Draft'), draft ? undefined : c.status)
    $('#status-history').innerHTML = [...c.statusHistory].reverse().map(h => `
      <tr data-testid="status-history-row">
        <td>${App.badge(h.status, 'status-history-status')}</td>
        <td data-testid="status-history-date">${App.dateTime(h.changedAt)}</td>
        <td data-testid="status-history-user">${esc(h.changedBy)}</td>
      </tr>`).join('')
  }

  async function loadCandidate() {
    const res = await api('GET', base)
    if (!res.ok) {
      $('#profile').hidden = true
      $('#not-found').hidden = false
      return false
    }
    candidate = res.data
    renderCandidate()
    $('#profile').hidden = false
    return true
  }

  $('#delete-candidate').addEventListener('click', async () => {
    const name = `${candidate.firstName} ${candidate.lastName}`
    const confirmed = await App.confirmDialog({
      title: 'Delete candidate',
      message: `Delete ${name}? Their notes, CV and job assignments will also be removed.`,
      confirmLabel: 'Delete'
    })
    if (!confirmed) return
    const res = await api('DELETE', base)
    if (!res.ok) return App.flash(App.errorMessage(res), 'error')
    App.flashNext(`${name} was deleted`)
    location.href = '/candidates'
  })

  // --- Status ---

  $('#status-form').addEventListener('submit', async e => {
    e.preventDefault()
    const form = e.target
    const status = form.elements.status.value
    if (status === candidate.status) {
      return App.showErrors(form, { status: `Candidate is already ${status}. Choose a different status.` })
    }
    App.clearErrors(form)
    const confirmed = await App.confirmDialog({
      title: 'Change status',
      message: `Change status from ${candidate.status} to ${status}?`,
      confirmLabel: 'Change status'
    })
    if (!confirmed) {
      form.elements.status.value = candidate.status
      return
    }
    const res = await api('PATCH', `${base}/status`, { status })
    if (res.ok) {
      candidate = res.data
      renderCandidate()
      App.flash(`Status changed to ${status}`)
    } else if (res.data && res.data.errors) {
      App.showErrors(form, res.data.errors)
    } else {
      App.flash(App.errorMessage(res), 'error')
    }
  })

  // --- CV ---

  $('#cv-form').addEventListener('submit', async e => {
    e.preventDefault()
    const form = e.target
    const file = form.elements.cv.files[0]
    if (!file) return App.showErrors(form, { cv: 'Choose a file to upload' })
    const problem = V.validateCvFile(file.name, file.size)
    if (problem) return App.showErrors(form, { cv: problem.message })
    App.clearErrors(form)

    const body = new FormData()
    body.append('cv', file)
    const res = await api('POST', `${base}/cv`, body)
    if (res.ok) {
      form.reset()
      await loadCandidate()
      App.flash(`CV uploaded: ${res.data.filename}`)
    } else if (res.data && res.data.errors) {
      App.showErrors(form, res.data.errors)
    } else {
      App.showErrors(form, { cv: App.errorMessage(res) })
    }
  })

  $('#cv-current').addEventListener('click', async e => {
    if (e.target.id !== 'cv-remove') return
    const confirmed = await App.confirmDialog({
      title: 'Remove CV',
      message: `Remove ${candidate.cv.filename}?`,
      confirmLabel: 'Remove'
    })
    if (!confirmed) return
    const res = await api('DELETE', `${base}/cv`)
    if (!res.ok) return App.flash(App.errorMessage(res), 'error')
    await loadCandidate()
    App.flash('CV removed')
  })

  // --- Jobs ---

  async function loadApplications() {
    const [appsRes, jobsRes] = await Promise.all([
      api('GET', `/api/pipeline?candidateId=${id}`),
      api('GET', '/api/jobs?status=Open')
    ])
    if (!appsRes.ok || !jobsRes.ok) return
    applications = appsRes.data.data
    $('#applications').innerHTML = applications.map(a => `
      <tr data-testid="application-row" data-application-id="${a.id}">
        <th scope="row"><a href="/jobs/${a.jobId}" data-testid="application-job-link">${esc(a.jobTitle)}</a></th>
        <td data-testid="application-client">${esc(a.client)}</td>
        <td>${App.badge(a.stage, 'application-stage')}</td>
        <td data-testid="application-updated">${App.dateTime(a.updatedAt)}</td>
      </tr>`).join('')
    $('#applications-empty').hidden = applications.length > 0

    const assigned = new Set(applications.map(a => a.jobId))
    const options = jobsRes.data.data
      .filter(job => !assigned.has(job.id))
      .map(job => ({ value: job.id, label: `${job.title} (${job.client})` }))
    App.fillSelect($('#assign-job'), options, '')
  }

  $('#assign-form').addEventListener('submit', async e => {
    e.preventDefault()
    const form = e.target
    const jobId = form.elements.jobId.value
    if (!jobId) return App.showErrors(form, { jobId: 'Select a job to assign' })
    App.clearErrors(form)
    const res = await api('POST', '/api/pipeline', { candidateId: candidate.id, jobId: Number(jobId) })
    if (res.ok) {
      await loadApplications()
      App.flash(`Assigned to ${res.data.jobTitle} at the Applied stage`)
    } else if (res.data && res.data.errors) {
      App.showErrors(form, res.data.errors)
    } else {
      App.showErrors(form, { jobId: App.errorMessage(res) })
    }
  })

  // --- Notes ---

  function noteView(n) {
    const canModify = user.role === 'admin' || n.authorId === user.id
    const edited = n.updatedAt !== n.createdAt ? ' <span data-testid="note-edited">(edited)</span>' : ''
    const actions = canModify
      ? `<div class="actions">
           <button type="button" class="small" data-note-action="edit" data-testid="note-edit-button">Edit</button>
           <button type="button" class="small danger" data-note-action="delete" data-testid="note-delete-button">Delete</button>
         </div>`
      : ''
    return `
      <p class="note-text" data-testid="note-text">${esc(n.text)}</p>
      <p class="meta"><span data-testid="note-author">${esc(n.authorName)}</span> ·
        <time datetime="${esc(n.createdAt)}" data-testid="note-date">${App.dateTime(n.createdAt)}</time>${edited}</p>
      ${actions}`
  }

  function noteEditor(n) {
    return `
      <form novalidate data-testid="note-edit-form">
        <div class="field">
          <label for="note-edit-${n.id}">Edit note</label>
          <textarea id="note-edit-${n.id}" name="text" rows="3" aria-describedby="note-edit-error-${n.id}" data-testid="note-edit-input">${esc(n.text)}</textarea>
          <p class="field-error" id="note-edit-error-${n.id}" data-error-for="text" data-testid="note-edit-error" hidden></p>
        </div>
        <div class="actions">
          <button type="submit" class="small primary" data-testid="note-save-button">Save</button>
          <button type="button" class="small" data-note-action="cancel" data-testid="note-cancel-button">Cancel</button>
        </div>
      </form>`
  }

  function renderNotes() {
    $('#notes').innerHTML = notes.map(n =>
      `<li data-testid="note-item" data-note-id="${n.id}">${n.id === editingNoteId ? noteEditor(n) : noteView(n)}</li>`
    ).join('')
    $('#notes-count').textContent = notes.length
    $('#notes-empty').hidden = notes.length > 0
  }

  async function loadNotes() {
    const res = await api('GET', `${base}/notes`)
    if (!res.ok) return
    notes = res.data.data
    renderNotes()
  }

  // Validates locally, sends the request, and shows field errors from either side
  async function saveNote(form, method, url) {
    const data = { text: form.elements.text.value.trim() }
    const errors = V.validateNote(data)
    if (hasErrors(errors)) {
      App.showErrors(form, errors)
      return false
    }
    App.clearErrors(form)
    const res = await api(method, url, data)
    if (res.ok) return true
    if (res.data && res.data.errors) App.showErrors(form, res.data.errors)
    else App.flash(App.errorMessage(res), 'error')
    return false
  }

  $('#note-form').addEventListener('submit', async e => {
    e.preventDefault()
    if (!(await saveNote(e.target, 'POST', `${base}/notes`))) return
    e.target.reset()
    await loadNotes()
    App.flash('Note added')
  })

  $('#notes').addEventListener('submit', async e => {
    e.preventDefault()
    const noteId = e.target.closest('[data-note-id]').dataset.noteId
    if (!(await saveNote(e.target, 'PUT', `${base}/notes/${noteId}`))) return
    editingNoteId = null
    await loadNotes()
    App.flash('Note updated')
  })

  $('#notes').addEventListener('click', async e => {
    const button = e.target.closest('button[data-note-action]')
    if (!button) return
    const noteId = Number(button.closest('[data-note-id]').dataset.noteId)
    const action = button.dataset.noteAction

    if (action === 'edit' || action === 'cancel') {
      editingNoteId = action === 'edit' ? noteId : null
      renderNotes()
      if (action === 'edit') $(`#note-edit-${noteId}`).focus()
      return
    }
    const confirmed = await App.confirmDialog({
      title: 'Delete note',
      message: 'Delete this note? This cannot be undone.',
      confirmLabel: 'Delete'
    })
    if (!confirmed) return
    const res = await api('DELETE', `${base}/notes/${noteId}`)
    if (!res.ok) return App.flash(App.errorMessage(res), 'error')
    await loadNotes()
    App.flash('Note deleted')
  })

  // --- Start ---

  if (await loadCandidate()) await Promise.all([loadNotes(), loadApplications()])
})()
