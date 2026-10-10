const path = require('path')
const express = require('express')

const router = express.Router()
const VIEWS = path.join(__dirname, '..', '..', 'views')
const view = name => (req, res) => res.sendFile(path.join(VIEWS, name))

function requireLogin(req, res, next) {
  if (req.session.user) return next()
  res.redirect('/login?next=' + encodeURIComponent(req.originalUrl))
}

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/candidates')
  res.sendFile(path.join(VIEWS, 'login.html'))
})

router.use(requireLogin)

router.get('/', (req, res) => res.redirect('/candidates'))
router.get('/candidates', view('candidates.html'))
router.get('/candidates/new', view('candidate-form.html'))
router.get('/candidates/:id', view('candidate.html'))
router.get('/jobs', view('jobs.html'))
router.get('/jobs/new', view('job-form.html'))
router.get('/jobs/:id/edit', view('job-form.html'))
router.get('/jobs/:id', view('job.html'))
router.get('/pipeline', view('pipeline.html'))

router.get('/users', (req, res) => {
  if (req.session.user.role !== 'admin') return res.status(403).sendFile(path.join(VIEWS, '403.html'))
  res.sendFile(path.join(VIEWS, 'users.html'))
})

router.use((req, res) => res.status(404).sendFile(path.join(VIEWS, '404.html')))

module.exports = router
