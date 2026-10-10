(async () => {
  await App.init('pipeline')
  const { $, esc, api, slug } = App
  const V = Validators
  const board = $('#board')
  const jobFilter = $('#job-filter')
  let applications = []

  function card(a) {
    const name = esc(a.candidateName)
    const controls = V.FINAL_STAGES.includes(a.stage)
      ? '<p class="muted" data-testid="pipeline-card-final">Final stage</p>'
      : `<label class="sr-only" for="stage-${a.id}">Move ${name} to stage</label>
         <select id="stage-${a.id}" data-testid="pipeline-stage-select">
           ${V.STAGES.map(s => `<option value="${s}"${s === a.stage ? ' selected' : ''}>${s}</option>`).join('')}
         </select>
         <button type="button" class="small primary" data-action="move" data-testid="pipeline-move-button" aria-label="Move ${name}">Move</button>`
    return `
      <li class="card" data-testid="pipeline-card" data-application-id="${a.id}" data-stage="${a.stage}">
        <a href="/candidates/${a.candidateId}" data-testid="pipeline-card-candidate">${name}</a>
        <p><a href="/jobs/${a.jobId}" data-testid="pipeline-card-job">${esc(a.jobTitle)}</a> · ${esc(a.client)}</p>
        ${controls}
        <button type="button" class="small danger" data-action="remove" data-testid="pipeline-remove-button" aria-label="Remove ${name} from ${esc(a.jobTitle)}">Remove</button>
      </li>`
  }

  function render() {
    board.innerHTML = V.STAGES.map(stage => {
      const items = applications.filter(a => a.stage === stage)
      const key = slug(stage)
      return `
        <section class="board-column" aria-labelledby="column-${key}" data-testid="pipeline-column-${key}" data-stage="${stage}">
          <h2 id="column-${key}">${stage} <span class="count" data-testid="pipeline-count-${key}">${items.length}</span></h2>
          <ul>${items.map(card).join('') || '<li class="muted" data-testid="pipeline-column-empty">No candidates</li>'}</ul>
        </section>`
    }).join('')
    const total = applications.length
    $('#result-count').textContent = `${total} candidate-job pairing${total === 1 ? '' : 's'}`
  }

  async function load() {
    const query = jobFilter.value ? `?jobId=${jobFilter.value}` : ''
    history.replaceState(null, '', location.pathname + query)
    board.setAttribute('aria-busy', 'true')
    const res = await api('GET', `/api/pipeline${query}`)
    board.setAttribute('aria-busy', 'false')
    if (!res.ok) return App.flash(App.errorMessage(res), 'error')
    applications = res.data.data
    render()
  }

  async function move(a, stage) {
    if (stage === a.stage) {
      return App.flash(`${a.candidateName} is already at the ${stage} stage. Choose a different stage.`, 'error')
    }
    const final = V.FINAL_STAGES.includes(stage) ? ' This is a final stage and cannot be changed afterwards.' : ''
    const confirmed = await App.confirmDialog({
      title: 'Confirm stage change',
      message: `Move ${a.candidateName} from ${a.stage} to ${stage} for ${a.jobTitle}?${final}`,
      confirmLabel: `Move to ${stage}`
    })
    if (!confirmed) return render()
    const res = await api('PATCH', `/api/pipeline/${a.id}`, { stage })
    if (!res.ok) return App.flash(App.errorMessage(res), 'error')
    await load()
    App.flash(`${a.candidateName} moved to ${stage}`)
  }

  async function remove(a) {
    const confirmed = await App.confirmDialog({
      title: 'Remove from job',
      message: `Remove ${a.candidateName} from ${a.jobTitle}?`,
      confirmLabel: 'Remove'
    })
    if (!confirmed) return
    const res = await api('DELETE', `/api/pipeline/${a.id}`)
    if (!res.ok) return App.flash(App.errorMessage(res), 'error')
    await load()
    App.flash(`${a.candidateName} removed from ${a.jobTitle}`)
  }

  board.addEventListener('click', e => {
    const button = e.target.closest('button[data-action]')
    if (!button) return
    const cardEl = button.closest('[data-application-id]')
    const application = applications.find(a => a.id === Number(cardEl.dataset.applicationId))
    if (button.dataset.action === 'move') move(application, $('select', cardEl).value)
    else remove(application)
  })

  jobFilter.addEventListener('change', load)
  $('#filters').addEventListener('submit', e => e.preventDefault())

  const jobsRes = await api('GET', '/api/jobs')
  if (jobsRes.ok) {
    const requested = new URLSearchParams(location.search).get('jobId') || ''
    const options = jobsRes.data.data.map(job => ({ value: job.id, label: `${job.title} (${job.client})` }))
    App.fillSelect(jobFilter, options, '')
    if (options.some(o => String(o.value) === requested)) jobFilter.value = requested
  }
  load()
})()
