(async () => {
  await App.init('candidates')
  const { $, esc, api } = App
  const V = Validators
  const PAGE_SIZE = 10
  const SORTS = ['name', 'email', 'location', 'salary', 'status', 'createdAt']

  const form = $('#filters')
  const table = $('#candidates-table')
  const rows = $('#rows')
  const state = { search: '', status: '', skill: '', sort: 'name', order: 'asc', page: 1 }
  let latestRequest = 0

  App.fillSelect(form.elements.status, V.CANDIDATE_STATUSES)
  App.fillSelect(form.elements.skill, V.SKILLS)

  // The URL query string is the source of truth, so filtered views can be linked and reloaded
  function readUrl() {
    const p = new URLSearchParams(location.search)
    state.search = p.get('search') || ''
    state.status = V.CANDIDATE_STATUSES.includes(p.get('status')) ? p.get('status') : ''
    state.skill = V.SKILLS.includes(p.get('skill')) ? p.get('skill') : ''
    state.sort = SORTS.includes(p.get('sort')) ? p.get('sort') : 'name'
    state.order = p.get('order') === 'desc' ? 'desc' : 'asc'
    state.page = Math.max(1, parseInt(p.get('page'), 10) || 1)
    form.elements.search.value = state.search
    form.elements.status.value = state.status
    form.elements.skill.value = state.skill
  }

  function writeUrl(push) {
    const p = new URLSearchParams()
    if (state.search) p.set('search', state.search)
    if (state.status) p.set('status', state.status)
    if (state.skill) p.set('skill', state.skill)
    if (state.sort !== 'name') p.set('sort', state.sort)
    if (state.order !== 'asc') p.set('order', state.order)
    if (state.page > 1) p.set('page', state.page)
    const query = p.toString()
    history[push ? 'pushState' : 'replaceState'](null, '', query ? `?${query}` : location.pathname)
  }

  function renderRows(data) {
    rows.innerHTML = data.map(c => `
      <tr data-testid="candidate-row" data-candidate-id="${c.id}">
        <th scope="row"><a href="/candidates/${c.id}" data-testid="candidate-name-link">${esc(c.firstName)} ${esc(c.lastName)}</a></th>
        <td data-testid="candidate-email">${esc(c.email) || '—'}</td>
        <td data-testid="candidate-location">${esc(c.location) || '—'}</td>
        <td data-testid="candidate-skills">${esc(c.skills.join(', ')) || '—'}</td>
        <td data-testid="candidate-salary">${App.salaryRange(c.salaryMin, c.salaryMax)}</td>
        <td>${App.badge(c.status, 'candidate-status')}</td>
        <td data-testid="candidate-created">${App.date(c.createdAt)}</td>
      </tr>`).join('')
  }

  function renderSort() {
    table.querySelectorAll('th[data-sort]').forEach(th => {
      const active = th.dataset.sort === state.sort
      th.setAttribute('aria-sort', active ? (state.order === 'asc' ? 'ascending' : 'descending') : 'none')
      $('span', th).textContent = active ? (state.order === 'asc' ? '▲' : '▼') : ''
    })
  }

  function renderPagination(totalPages) {
    $('#pagination').hidden = totalPages === 0
    $('#prev-page').disabled = state.page <= 1
    $('#next-page').disabled = state.page >= totalPages
    $('#page-info').textContent = `Page ${state.page} of ${totalPages}`
    let items = ''
    for (let n = 1; n <= totalPages; n++) {
      items += `<li><button type="button" data-page="${n}" data-testid="pagination-page-${n}" aria-label="Page ${n}"${n === state.page ? ' aria-current="page"' : ''}>${n}</button></li>`
    }
    $('#page-list').innerHTML = items
  }

  async function load() {
    const p = new URLSearchParams({ sort: state.sort, order: state.order, page: state.page, pageSize: PAGE_SIZE })
    for (const key of ['search', 'status', 'skill']) if (state[key]) p.set(key, state[key])

    const request = ++latestRequest
    table.setAttribute('aria-busy', 'true')
    const res = await api('GET', `/api/candidates?${p}`)
    // A newer search started while this one was in flight; let that one render
    if (request !== latestRequest) return
    table.setAttribute('aria-busy', 'false')
    if (!res.ok) {
      App.flash(App.errorMessage(res), 'error')
      return
    }
    const { data, total, totalPages } = res.data
    // A page beyond the end (for example after narrowing a filter) falls back to the last page
    if (totalPages > 0 && state.page > totalPages) {
      state.page = totalPages
      writeUrl(false)
      return load()
    }

    renderRows(data)
    renderSort()
    renderPagination(totalPages)
    $('#empty').hidden = total > 0
    const first = (state.page - 1) * PAGE_SIZE + 1
    $('#result-count').textContent = total === 0
      ? 'No candidates found'
      : `Showing ${first}–${first + data.length - 1} of ${total} candidate${total === 1 ? '' : 's'}`
  }

  function applyFilters() {
    state.search = form.elements.search.value.trim()
    state.status = form.elements.status.value
    state.skill = form.elements.skill.value
    state.page = 1
    writeUrl(true)
    load()
  }

  function goToPage(page) {
    state.page = page
    writeUrl(true)
    load()
  }

  form.addEventListener('submit', e => {
    e.preventDefault()
    applyFilters()
  })
  form.elements.status.addEventListener('change', applyFilters)
  form.elements.skill.addEventListener('change', applyFilters)
  $('#clear-filters').addEventListener('click', () => {
    form.reset()
    applyFilters()
  })

  table.querySelector('thead').addEventListener('click', e => {
    const th = e.target.closest('th[data-sort]')
    if (!th || !e.target.closest('button')) return
    state.order = state.sort === th.dataset.sort && state.order === 'asc' ? 'desc' : 'asc'
    state.sort = th.dataset.sort
    goToPage(1)
  })

  $('#prev-page').addEventListener('click', () => goToPage(state.page - 1))
  $('#next-page').addEventListener('click', () => goToPage(state.page + 1))
  $('#page-list').addEventListener('click', e => {
    const button = e.target.closest('button[data-page]')
    if (button) goToPage(Number(button.dataset.page))
  })

  window.addEventListener('popstate', () => {
    readUrl()
    load()
  })

  readUrl()
  load()
})()
