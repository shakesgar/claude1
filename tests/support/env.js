const path = require('path')

const AUTH_DIR = path.join(__dirname, '..', '.auth')

// Saved sessions, written by global-setup.js
const STORAGE_STATE = {
  recruiter: path.join(AUTH_DIR, 'recruiter.json'),
  admin: path.join(AUTH_DIR, 'admin.json')
}
const NO_SESSION = { cookies: [], origins: [] }

// Seeded demo accounts (see README.md); none of these are real people
const PASSWORD = 'Password123!'
const USERS = {
  recruiter: { name: 'Riley Recruiter', email: 'recruiter@example.com', password: PASSWORD, role: 'recruiter' },
  admin: { name: 'Alex Admin', email: 'admin@example.com', password: PASSWORD, role: 'admin' },
  disabled: { name: 'Dana Disabled', email: 'disabled@example.com', password: PASSWORD, role: 'recruiter' }
}

module.exports = { STORAGE_STATE, NO_SESSION, USERS }
