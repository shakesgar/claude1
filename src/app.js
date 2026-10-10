const path = require('path')
const express = require('express')
const session = require('express-session')

const { db, reset, counts } = require('./store')
const { requireAuth, requireAdmin } = require('./auth')

const PUBLIC = path.join(__dirname, '..', 'public')

function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))
  app.use(session({
    name: 'crm.sid',
    // Demo app only: a real app would load the secret from the environment
    secret: 'recruit-demo-crm-not-a-real-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' }
  }))

  app.use('/css', express.static(path.join(PUBLIC, 'css')))
  app.use('/js', express.static(path.join(PUBLIC, 'js')))

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  app.use('/api/auth', require('./routes/auth'))

  if (process.env.NODE_ENV === 'test') {
    app.post('/api/test/reset', (req, res) => {
      reset()
      res.json({ message: 'Seed data restored', counts: counts() })
    })
  }

  app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
    const data = db.users.map(({ password, ...user }) => user)
    res.json({ data, total: data.length })
  })
  app.use('/api/candidates', requireAuth, require('./routes/candidates'))
  app.use('/api/jobs', requireAuth, require('./routes/jobs'))
  app.use('/api/pipeline', requireAuth, require('./routes/pipeline'))
  app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found' }))

  app.use(require('./routes/pages'))

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err)
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' })
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large' })
    console.error(err)
    res.status(500).json({ error: 'Unexpected server error' })
  })

  return app
}

module.exports = { createApp }
