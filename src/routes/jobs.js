const express = require('express')
const V = require('../../public/js/validators')
const { db, nextId } = require('../store')
const { requireAdmin } = require('../auth')
const { isObject, hasErrors, text, number, parseId, validationError, notFound } = require('../http')

const router = express.Router()

function findJob(req, res) {
  const id = parseId(req.params.id)
  const job = id === null ? undefined : db.jobs.find(j => j.id === id)
  if (!job) notFound(res, 'Job')
  return job
}

function pickJob(body) {
  return {
    title: text(body.title),
    client: text(body.client),
    location: text(body.location),
    salaryMin: number(body.salaryMin),
    salaryMax: number(body.salaryMax),
    status: text(body.status),
    description: text(body.description)
  }
}

function withCount(job) {
  return { ...job, applicationCount: db.applications.filter(a => a.jobId === job.id).length }
}

router.get('/', (req, res) => {
  const q = key => (typeof req.query[key] === 'string' ? req.query[key].trim() : '')
  const status = q('status')
  const search = q('search').toLowerCase()
  if (status && !V.JOB_STATUSES.includes(status)) {
    return validationError(res, { status: `Status must be one of: ${V.JOB_STATUSES.join(', ')}` })
  }
  const data = db.jobs
    .filter(j => !status || j.status === status)
    .filter(j => !search || `${j.title} ${j.client}`.toLowerCase().includes(search))
    .map(withCount)
  res.json({ data, total: data.length })
})

router.post('/', (req, res) => {
  const data = pickJob(isObject(req.body) ? req.body : {})
  const errors = V.validateJob(data)
  if (hasErrors(errors)) return validationError(res, errors)

  const now = new Date().toISOString()
  const job = { id: nextId('jobs'), ...data, createdAt: now, updatedAt: now }
  db.jobs.push(job)
  res.status(201).location(`/api/jobs/${job.id}`).json(withCount(job))
})

router.get('/:id', (req, res) => {
  const job = findJob(req, res)
  if (job) res.json(withCount(job))
})

router.put('/:id', (req, res) => {
  const job = findJob(req, res)
  if (!job) return
  const data = pickJob(isObject(req.body) ? req.body : {})
  const errors = V.validateJob(data)
  if (hasErrors(errors)) return validationError(res, errors)

  Object.assign(job, data, { updatedAt: new Date().toISOString() })
  res.json(withCount(job))
})

router.delete('/:id', requireAdmin, (req, res) => {
  const job = findJob(req, res)
  if (!job) return
  db.jobs = db.jobs.filter(j => j.id !== job.id)
  db.applications = db.applications.filter(a => a.jobId !== job.id)
  res.status(204).end()
})

module.exports = router
