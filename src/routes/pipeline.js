const express = require('express')
const V = require('../../public/js/validators')
const { db, nextId, setCandidateStatus } = require('../store')
const { isObject, hasErrors, text, parseId, validationError, notFound, conflict } = require('../http')

const router = express.Router()
const STAGE_MESSAGE = `Stage must be one of: ${V.STAGES.join(', ')}`

// Adds display names so clients do not need extra lookups
function enrich(application) {
  const candidate = db.candidates.find(c => c.id === application.candidateId)
  const job = db.jobs.find(j => j.id === application.jobId)
  return {
    ...application,
    candidateName: candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Unknown candidate',
    jobTitle: job ? job.title : 'Unknown job',
    client: job ? job.client : ''
  }
}

function findApplication(req, res) {
  const id = parseId(req.params.id)
  const application = id === null ? undefined : db.applications.find(a => a.id === id)
  if (!application) notFound(res, 'Pipeline entry')
  return application
}

router.get('/', (req, res) => {
  const q = key => (typeof req.query[key] === 'string' ? req.query[key].trim() : '')
  const errors = {}
  const jobId = q('jobId') === '' ? null : parseId(q('jobId'))
  const candidateId = q('candidateId') === '' ? null : parseId(q('candidateId'))
  const stage = q('stage')
  if (q('jobId') !== '' && jobId === null) errors.jobId = 'Job ID must be a whole number'
  if (q('candidateId') !== '' && candidateId === null) errors.candidateId = 'Candidate ID must be a whole number'
  if (stage && !V.STAGES.includes(stage)) errors.stage = STAGE_MESSAGE
  if (hasErrors(errors)) return validationError(res, errors)

  const data = db.applications
    .filter(a => jobId === null || a.jobId === jobId)
    .filter(a => candidateId === null || a.candidateId === candidateId)
    .filter(a => !stage || a.stage === stage)
    .map(enrich)
  res.json({ data, total: data.length })
})

router.post('/', (req, res) => {
  const body = isObject(req.body) ? req.body : {}
  const errors = {}
  const candidateId = parseId(text(body.candidateId))
  const jobId = parseId(text(body.jobId))
  if (text(body.candidateId) === '') errors.candidateId = 'Candidate is required'
  else if (candidateId === null) errors.candidateId = 'Candidate ID must be a whole number'
  if (text(body.jobId) === '') errors.jobId = 'Job is required'
  else if (jobId === null) errors.jobId = 'Job ID must be a whole number'
  if (hasErrors(errors)) return validationError(res, errors)

  const candidate = db.candidates.find(c => c.id === candidateId)
  if (!candidate) return notFound(res, 'Candidate')
  const job = db.jobs.find(j => j.id === jobId)
  if (!job) return notFound(res, 'Job')
  if (candidate.status === 'Draft') return conflict(res, 'Draft candidates cannot be assigned to jobs')
  if (job.status !== 'Open') return conflict(res, 'Candidates can only be assigned to open jobs')
  if (db.applications.some(a => a.candidateId === candidateId && a.jobId === jobId)) {
    return conflict(res, 'This candidate is already assigned to this job')
  }

  const now = new Date().toISOString()
  const application = {
    id: nextId('applications'),
    candidateId,
    jobId,
    stage: 'Applied',
    history: [{ stage: 'Applied', changedAt: now, changedBy: req.session.user.name }],
    createdAt: now,
    updatedAt: now
  }
  db.applications.push(application)
  res.status(201).location(`/api/pipeline/${application.id}`).json(enrich(application))
})

router.get('/:id', (req, res) => {
  const application = findApplication(req, res)
  if (application) res.json(enrich(application))
})

router.patch('/:id', (req, res) => {
  const application = findApplication(req, res)
  if (!application) return
  const stage = text(isObject(req.body) ? req.body.stage : '')
  if (!stage) return validationError(res, { stage: 'Stage is required' })
  if (!V.STAGES.includes(stage)) return validationError(res, { stage: STAGE_MESSAGE })
  if (V.FINAL_STAGES.includes(application.stage)) {
    return conflict(res, `${application.stage} is a final stage and cannot be changed`)
  }
  if (application.stage === stage) return conflict(res, `This candidate is already at the ${stage} stage`)

  const now = new Date().toISOString()
  application.stage = stage
  application.history.push({ stage, changedAt: now, changedBy: req.session.user.name })
  application.updatedAt = now

  // A placement also updates the candidate record
  if (stage === 'Placed') {
    const candidate = db.candidates.find(c => c.id === application.candidateId)
    if (candidate) setCandidateStatus(candidate, 'Placed', req.session.user.name)
  }
  res.json(enrich(application))
})

router.delete('/:id', (req, res) => {
  const application = findApplication(req, res)
  if (!application) return
  db.applications = db.applications.filter(a => a.id !== application.id)
  res.status(204).end()
})

module.exports = router
