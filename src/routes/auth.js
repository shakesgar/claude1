const express = require('express')
const V = require('../../public/js/validators')
const { db } = require('../store')
const { isObject, hasErrors, text, validationError } = require('../http')

const router = express.Router()

router.post('/login', (req, res, next) => {
  const body = isObject(req.body) ? req.body : {}
  const email = text(body.email).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  const errors = V.validateLogin({ email, password })
  if (hasErrors(errors)) return validationError(res, errors)

  const user = db.users.find(u => u.email === email)
  if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid email or password' })
  if (!user.active) return res.status(403).json({ error: 'This account has been disabled' })

  req.session.regenerate(err => {
    if (err) return next(err)
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role }
    res.json({ user: req.session.user })
  })
})

router.post('/logout', (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err)
    res.clearCookie('crm.sid')
    res.status(204).end()
  })
})

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Authentication required' })
  res.json({ user: req.session.user })
})

module.exports = router
