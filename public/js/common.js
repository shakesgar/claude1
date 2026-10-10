// Shared helpers for every page: API calls, header, messages, confirmation dialog, formatting
const App = (() => {
  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  const NAV = [
    { id: 'candidates', href: '/candidates', label: 'Candidates' },
    { id: 'jobs', href: '/jobs', label: 'Jobs' },
    { id: 'pipeline', href: '/pipeline', label: 'Pipeline' },
    { id: 'users', href: '/users', label: 'Users', admin: true }
  ]
  let user = null

  const $ = (selector, root = document) => root.querySelector(selector)
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ESCAPES[c])
  const slug = v => String(v).toLowerCase().replace(/#/g, ' sharp').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  // Resolves to { ok, status, data } and never throws for HTTP errors
  async function api(method, url, body) {
    const options = { method, headers: { Accept: 'application/json' }, credentials: 'same-origin' }
    if (body instanceof FormData) {
      options.body = body
    } else if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json'
      options.body = JSON.stringify(body)
    }
    let res
    try {
      res = await fetch(url, options)
    } catch {
      return { ok: false, status: 0, data: { error: 'Could not reach the server' } }
    }
    let data = null
    if (res.status !== 204) {
      try {
        data = await res.json()
      } catch {
        data = null
      }
    }
    if (res.status === 401 && !url.startsWith('/api/auth/')) {
      location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search)
    }
    return { ok: res.ok, status: res.status, data }
  }

  const errorMessage = res => (res.data && res.data.error) || 'Something went wrong. Please try again.'

  function renderHeader(active) {
    const header = $('#app-header')
    if (!header) return
    const links = NAV.filter(n => !n.admin || user.role === 'admin').map(n =>
      `<li><a href="${n.href}" data-testid="nav-${n.id}"${n.id === active ? ' aria-current="page"' : ''}>${n.label}</a></li>`
    ).join('')
    header.innerHTML = `
      <a class="skip-link" href="#main" data-testid="skip-link">Skip to main content</a>
      <div class="header-inner">
        <a class="brand" href="/candidates" data-testid="nav-brand">Recruit Demo CRM</a>
        <nav aria-label="Main" data-testid="main-nav"><ul>${links}</ul></nav>
        <div class="user-box">
          <span data-testid="current-user-name">${esc(user.name)}</span>
          <span class="role-tag" data-testid="current-user-role">${esc(user.role)}</span>
          <button type="button" class="small" id="logout-button" data-testid="logout-button">Log out</button>
        </div>
      </div>`
    $('#logout-button').addEventListener('click', async () => {
      await api('POST', '/api/auth/logout')
      location.href = '/login'
    })
  }

  // Loads the signed-in user, draws the header, and shows any message left by the previous page
  async function init(active) {
    const res = await api('GET', '/api/auth/me')
    if (!res.ok) {
      location.href = '/login'
      return new Promise(() => {})
    }
    user = res.data.user
    renderHeader(active)
    try {
      const pending = sessionStorage.getItem('flash')
      if (pending) {
        sessionStorage.removeItem('flash')
        flash(pending)
      }
    } catch {
      // sessionStorage unavailable: skip the carried-over message
    }
    return user
  }

  function flash(message, type = 'success') {
    const el = $('#flash')
    if (!el) return
    el.textContent = message
    el.className = `flash flash-${type}`
    el.dataset.flashType = type
    el.setAttribute('role', type === 'error' ? 'alert' : 'status')
    el.hidden = false
  }

  function flashNext(message) {
    try {
      sessionStorage.setItem('flash', message)
    } catch {
      // sessionStorage unavailable: the next page simply shows no message
    }
  }

  function clearErrors(root) {
    root.querySelectorAll('[data-error-for]').forEach(el => {
      el.textContent = ''
      el.hidden = true
    })
    root.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'))
  }

  // errors is { fieldName: message }; matches [data-error-for] elements and [name] inputs
  function showErrors(root, errors) {
    clearErrors(root)
    for (const [key, message] of Object.entries(errors)) {
      const el = root.querySelector(`[data-error-for="${CSS.escape(key)}"]`)
      if (el) {
        el.textContent = message
        el.hidden = false
      }
      root.querySelectorAll(`[name="${CSS.escape(key)}"]`).forEach(input => input.setAttribute('aria-invalid', 'true'))
    }
  }

  function confirmDialog({ title, message, confirmLabel = 'Confirm' }) {
    let dialog = $('#confirm-dialog')
    if (!dialog) {
      dialog = document.createElement('dialog')
      dialog.id = 'confirm-dialog'
      dialog.dataset.testid = 'confirm-dialog'
      dialog.setAttribute('aria-labelledby', 'confirm-title')
      dialog.setAttribute('aria-describedby', 'confirm-message')
      dialog.innerHTML = `
        <h2 id="confirm-title" data-testid="confirm-title"></h2>
        <p id="confirm-message" data-testid="confirm-message"></p>
        <div class="actions">
          <button type="button" value="cancel" data-testid="confirm-cancel">Cancel</button>
          <button type="button" class="primary" value="confirm" data-testid="confirm-accept"></button>
        </div>`
      dialog.addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') dialog.close(e.target.value)
      })
      document.body.appendChild(dialog)
    }
    $('#confirm-title', dialog).textContent = title
    $('#confirm-message', dialog).textContent = message
    $('[data-testid="confirm-accept"]', dialog).textContent = confirmLabel
    dialog.returnValue = ''
    return new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true })
      dialog.showModal()
    })
  }

  function fillSelect(select, options, selected) {
    const existing = select.querySelector('option[value=""]')
    select.innerHTML = (existing ? existing.outerHTML : '') + options.map(o => {
      const value = typeof o === 'object' ? o.value : o
      const label = typeof o === 'object' ? o.label : o
      return `<option value="${esc(value)}">${esc(label)}</option>`
    }).join('')
    if (selected !== undefined) select.value = selected
  }

  const money = n => (n === null || n === undefined || n === '' ? '—' : '£' + Number(n).toLocaleString('en-GB'))
  const salaryRange = (min, max) => (min == null && max == null ? '—' : `${money(min)} – ${money(max)}`)
  const DATE_FORMAT = { day: '2-digit', month: 'short', year: 'numeric' }
  // Accepts YYYY-MM-DD or a full ISO timestamp
  const date = v => (v ? new Date(v.length === 10 ? v + 'T00:00:00' : v).toLocaleDateString('en-GB', DATE_FORMAT) : '—')
  const dateTime = v => (v ? new Date(v).toLocaleString('en-GB', { ...DATE_FORMAT, hour: '2-digit', minute: '2-digit' }) : '—')
  const fileSize = bytes => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)
  const badge = (status, testid) => `<span class="badge badge-${slug(status)}" data-testid="${testid}">${esc(status)}</span>`

  return {
    $, esc, slug, api, errorMessage, init, flash, flashNext, clearErrors, showErrors, confirmDialog,
    fillSelect, money, salaryRange, date, dateTime, fileSize, badge,
    get user() { return user }
  }
})()
