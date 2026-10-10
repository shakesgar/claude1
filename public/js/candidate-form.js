(async () => {
  await App.init('candidates')
  const { $, esc, api } = App
  const V = Validators

  const STEPS = [
    { title: 'Personal details', validate: V.validatePersonal },
    { title: 'Employment history', validate: V.validateEmployment },
    { title: 'Skills and salary expectations', validate: V.validateSkillsSalary },
    { title: 'Right to work and availability', validate: V.validateRightToWork },
    { title: 'Review and submit', validate: () => ({}) }
  ]
  const PERSONAL_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'location']
  const SKILL_FIELDS = ['skills', 'salaryMin', 'salaryMax']
  const TEXT_FIELDS = [...PERSONAL_FIELDS, 'salaryMin', 'salaryMax', 'visaType', 'visaExpiry', 'noticePeriodWeeks', 'availableFrom']
  const REQUIRED = ' <span class="req" aria-hidden="true">*</span>'

  const form = $('#candidate-form')
  const summary = $('#error-summary')
  const rolesEl = $('#roles')
  const backButton = $('#back-button')
  const nextButton = $('#next-button')
  const submitButton = $('#submit-button')
  const draftButton = $('#save-draft-button')

  const emptyRole = () => ({ company: '', jobTitle: '', startDate: '', endDate: '', current: false })
  let step = 1
  let draftId = null
  let roles = [emptyRole()]

  const value = name => form.elements[name].value.trim()
  const checkedValue = name => (form.querySelector(`input[name="${name}"]:checked`) || {}).value || ''
  const hasErrors = errors => Object.keys(errors).length > 0

  function stepOf(key) {
    if (PERSONAL_FIELDS.includes(key)) return 1
    if (key.startsWith('employmentHistory')) return 2
    if (SKILL_FIELDS.includes(key)) return 3
    return key === 'confirm' ? 5 : 4
  }

  // --- Employment history rows ---

  function roleField(role, i, field, label, type, required) {
    const id = `employmentHistory-${i}-${field}`
    const disabled = field === 'endDate' && role.current ? ' disabled' : ''
    return `
      <div class="field">
        <label for="${id}">${label}${required ? REQUIRED : ''}</label>
        <input id="${id}" name="employmentHistory.${i}.${field}" type="${type}" value="${esc(role[field])}"${disabled} aria-describedby="${id}-error" data-testid="input-${id}">
        <p class="field-error" id="${id}-error" data-error-for="employmentHistory.${i}.${field}" data-testid="error-${id}" hidden></p>
      </div>`
  }

  function renderRoles() {
    rolesEl.innerHTML = roles.map((role, i) => `
      <fieldset class="role" data-role="${i}" data-testid="role-${i}">
        <legend>Role ${i + 1}</legend>
        <div class="grid">
          ${roleField(role, i, 'company', 'Company', 'text', true)}
          ${roleField(role, i, 'jobTitle', 'Job title', 'text', true)}
          ${roleField(role, i, 'startDate', 'Start date', 'date', true)}
          ${roleField(role, i, 'endDate', 'End date', 'date', false)}
        </div>
        <label class="check"><input type="checkbox" name="employmentHistory.${i}.current"${role.current ? ' checked' : ''} data-testid="input-employmentHistory-${i}-current"> I currently work here</label>
        <button type="button" class="danger small" data-remove="${i}" aria-label="Remove role ${i + 1}" data-testid="remove-role-${i}">Remove role</button>
      </fieldset>`).join('')
    $('#add-role').disabled = roles.length >= 10
  }

  function readRoles() {
    roles = roles.map((_, i) => {
      const current = form.elements[`employmentHistory.${i}.current`].checked
      return {
        company: value(`employmentHistory.${i}.company`),
        jobTitle: value(`employmentHistory.${i}.jobTitle`),
        startDate: value(`employmentHistory.${i}.startDate`),
        endDate: current ? '' : value(`employmentHistory.${i}.endDate`),
        current
      }
    })
  }

  $('#add-role').addEventListener('click', () => {
    readRoles()
    roles.push(emptyRole())
    renderRoles()
    form.elements[`employmentHistory.${roles.length - 1}.company`].focus()
  })

  rolesEl.addEventListener('click', e => {
    const button = e.target.closest('button[data-remove]')
    if (!button) return
    readRoles()
    roles.splice(Number(button.dataset.remove), 1)
    renderRoles()
    $('#add-role').focus()
  })

  // A current role has no end date
  rolesEl.addEventListener('change', e => {
    if (e.target.type !== 'checkbox') return
    const i = e.target.closest('[data-role]').dataset.role
    const endDate = form.elements[`employmentHistory.${i}.endDate`]
    endDate.disabled = e.target.checked
    if (e.target.checked) endDate.value = ''
  })

  // --- Conditional fields ---

  function syncConditionalFields() {
    $('#visa-fields').hidden = checkedValue('rightToWork') !== 'visa'
    $('#notice-fields').hidden = checkedValue('availability') !== 'notice'
    $('#date-fields').hidden = checkedValue('availability') !== 'date'
  }
  form.addEventListener('change', e => {
    if (e.target.name === 'rightToWork' || e.target.name === 'availability') syncConditionalFields()
  })

  // --- Collecting and filling data ---

  function collect() {
    readRoles()
    return {
      firstName: value('firstName'),
      lastName: value('lastName'),
      email: value('email'),
      phone: value('phone'),
      location: value('location'),
      employmentHistory: roles,
      skills: [...form.querySelectorAll('input[name="skills"]:checked')].map(input => input.value),
      salaryMin: value('salaryMin'),
      salaryMax: value('salaryMax'),
      rightToWork: checkedValue('rightToWork'),
      visaType: value('visaType'),
      visaExpiry: value('visaExpiry'),
      availability: checkedValue('availability'),
      noticePeriodWeeks: value('noticePeriodWeeks'),
      availableFrom: value('availableFrom'),
      willingToRelocate: form.elements.willingToRelocate.checked
    }
  }

  function fill(candidate) {
    for (const name of TEXT_FIELDS) form.elements[name].value = candidate[name] ?? ''
    form.querySelectorAll('input[name="skills"]').forEach(input => {
      input.checked = candidate.skills.includes(input.value)
    })
    for (const name of ['rightToWork', 'availability']) {
      form.querySelectorAll(`input[name="${name}"]`).forEach(input => {
        input.checked = input.value === candidate[name]
      })
    }
    form.elements.willingToRelocate.checked = candidate.willingToRelocate === true
    roles = candidate.employmentHistory.length ? candidate.employmentHistory.map(r => ({ ...r })) : [emptyRole()]
    renderRoles()
    syncConditionalFields()
  }

  // --- Review step ---

  function renderReview() {
    const d = collect()
    const row = (key, label, text) => `<div><dt>${label}</dt><dd data-testid="review-${key}">${esc(text) || '—'}</dd></div>`
    const group = (n, title, body) => `
      <section class="review-group" data-testid="review-section-${n}">
        <h3>${title} <button type="button" class="link-button" data-edit-step="${n}" data-testid="review-edit-${n}" aria-label="Edit ${title.toLowerCase()}">Edit</button></h3>
        ${body}
      </section>`
    const roleItems = d.employmentHistory.map((r, i) => `
      <li data-testid="review-role-${i}">${esc(r.jobTitle) || '—'} at ${esc(r.company) || '—'}
        (${App.date(r.startDate)} to ${r.current ? 'present' : App.date(r.endDate)})</li>`).join('')
    const rightToWork = [
      row('rightToWork', 'Right to work', V.RIGHT_TO_WORK_LABELS[d.rightToWork] || ''),
      d.rightToWork === 'visa' ? row('visaType', 'Visa type', d.visaType) + row('visaExpiry', 'Visa expiry date', d.visaExpiry && App.date(d.visaExpiry)) : '',
      row('availability', 'Availability', V.AVAILABILITY_LABELS[d.availability] || ''),
      d.availability === 'notice' ? row('noticePeriodWeeks', 'Notice period', d.noticePeriodWeeks && `${d.noticePeriodWeeks} weeks`) : '',
      d.availability === 'date' ? row('availableFrom', 'Available from', d.availableFrom && App.date(d.availableFrom)) : '',
      row('willingToRelocate', 'Willing to relocate', d.willingToRelocate ? 'Yes' : 'No')
    ].join('')

    $('#review').innerHTML =
      group(1, 'Personal details', `<dl class="details">
        ${row('name', 'Name', `${d.firstName} ${d.lastName}`.trim())}
        ${row('email', 'Email', d.email)}${row('phone', 'Phone', d.phone)}${row('location', 'Location', d.location)}</dl>`) +
      group(2, 'Employment history', `<ul data-testid="review-roles">${roleItems || '<li>No roles added</li>'}</ul>`) +
      group(3, 'Skills and salary', `<dl class="details">
        ${row('skills', 'Skills', d.skills.join(', '))}
        ${row('salary', 'Expected salary', d.salaryMin || d.salaryMax ? `£${d.salaryMin} – £${d.salaryMax}` : '')}</dl>`) +
      group(4, 'Right to work and availability', `<dl class="details">${rightToWork}</dl>`)
  }

  $('#review').addEventListener('click', e => {
    const button = e.target.closest('button[data-edit-step]')
    if (button) showStep(Number(button.dataset.editStep))
  })

  // --- Step navigation ---

  function showStep(n, focus = true) {
    step = n
    form.querySelectorAll('fieldset.step').forEach(fieldset => {
      fieldset.hidden = Number(fieldset.dataset.step) !== n
    })
    document.querySelectorAll('#progress-steps li').forEach(li => {
      const s = Number(li.dataset.step)
      li.dataset.state = s < n ? 'complete' : s === n ? 'current' : 'upcoming'
      if (s === n) li.setAttribute('aria-current', 'step')
      else li.removeAttribute('aria-current')
    })
    $('#progress-text').textContent = `Step ${n} of ${STEPS.length}: ${STEPS[n - 1].title}`
    $('#progress-bar').value = n
    backButton.hidden = n === 1
    nextButton.hidden = n === STEPS.length
    submitButton.hidden = n !== STEPS.length
    summary.hidden = true
    if (n === STEPS.length) renderReview()
    if (focus) $(`fieldset.step[data-step="${n}"] > legend`).focus()
  }

  function showStepErrors(errors) {
    App.showErrors(form, errors)
    const items = Object.values(errors).map(message => `<li data-testid="error-summary-item">${esc(message)}</li>`).join('')
    const count = Object.keys(errors).length
    summary.innerHTML = `<strong>There ${count === 1 ? 'is 1 problem' : `are ${count} problems`} on this step</strong><ul>${items}</ul>`
    summary.hidden = false
    summary.focus()
  }

  // Jumps to the earliest step that has an error and shows that step's errors
  function showErrorsAcrossSteps(errors) {
    const target = Math.min(...Object.keys(errors).map(stepOf))
    showStep(target, false)
    showStepErrors(Object.fromEntries(Object.entries(errors).filter(([key]) => stepOf(key) === target)))
  }

  backButton.addEventListener('click', () => {
    App.clearErrors(form)
    showStep(step - 1)
  })

  nextButton.addEventListener('click', () => {
    const errors = STEPS[step - 1].validate(collect(), {})
    if (hasErrors(errors)) return showStepErrors(errors)
    App.clearErrors(form)
    showStep(step + 1)
  })

  // --- Saving ---

  function setBusy(busy) {
    for (const button of [backButton, nextButton, submitButton, draftButton]) button.disabled = busy
  }

  async function save(data, draft) {
    setBusy(true)
    const payload = { ...data, status: draft ? 'Draft' : 'Active' }
    const res = draftId
      ? await api('PUT', `/api/candidates/${draftId}`, payload)
      : await api('POST', '/api/candidates', payload)
    setBusy(false)

    if (res.ok && draft) {
      draftId = res.data.id
      history.replaceState(null, '', `/candidates/new?draft=${draftId}`)
      App.clearErrors(form)
      summary.hidden = true
      App.flash(`Draft saved for ${res.data.firstName} ${res.data.lastName}`)
    } else if (res.ok) {
      App.flashNext('Candidate submitted')
      location.href = `/candidates/${res.data.id}`
    } else if (res.data && res.data.errors) {
      showErrorsAcrossSteps(res.data.errors)
    } else {
      App.flash(App.errorMessage(res), 'error')
    }
  }

  draftButton.addEventListener('click', () => {
    const data = collect()
    const errors = V.validateCandidate(data, { draft: true })
    if (hasErrors(errors)) return showErrorsAcrossSteps(errors)
    save(data, true)
  })

  form.addEventListener('submit', e => {
    e.preventDefault()
    // Enter in a text field submits the form; before the last step treat it as Next
    if (step !== STEPS.length) return nextButton.click()
    const data = collect()
    const errors = V.validateCandidate(data, {})
    if (!form.elements.confirm.checked) errors.confirm = 'Confirm the details are correct before submitting'
    if (hasErrors(errors)) return showErrorsAcrossSteps(errors)
    save(data, false)
  })

  // --- Start ---

  $('#skills-options').innerHTML = V.SKILLS.map(skill =>
    `<label class="check"><input type="checkbox" name="skills" value="${esc(skill)}" data-testid="skill-checkbox-${App.slug(skill)}"> ${esc(skill)}</label>`
  ).join('')
  renderRoles()

  const requestedDraft = new URLSearchParams(location.search).get('draft')
  if (requestedDraft) {
    const res = await api('GET', `/api/candidates/${encodeURIComponent(requestedDraft)}`)
    if (res.ok && res.data.status === 'Draft') {
      draftId = res.data.id
      fill(res.data)
      $('#form-title').textContent = `Continue draft: ${res.data.firstName} ${res.data.lastName}`
    } else if (res.ok) {
      location.replace(`/candidates/${res.data.id}`)
      return
    } else {
      App.flash('Draft not found. You can start a new candidate below.', 'error')
    }
  }
  showStep(1, false)
})()
