(async () => {
  await App.init('users')
  const { $, esc, api } = App

  const res = await api('GET', '/api/users')
  if (!res.ok) return App.flash(App.errorMessage(res), 'error')

  $('#rows').innerHTML = res.data.data.map(u => `
    <tr data-testid="user-row" data-user-id="${u.id}">
      <th scope="row" data-testid="user-name">${esc(u.name)}</th>
      <td data-testid="user-email">${esc(u.email)}</td>
      <td data-testid="user-role">${esc(u.role)}</td>
      <td>${App.badge(u.active ? 'Active' : 'Disabled', 'user-account-status')}</td>
    </tr>`).join('')
  $('#result-count').textContent = `${res.data.total} users`
})()
