const express = require('express')
const multer = require('multer')
const V = require('../../public/js/validators')
const { db, nextId, setCandidateStatus } = require('../store')
const { requireAdmin } = require('../auth')
const { isObject, hasErrors, text, number, parseId, validationError, notFound, conflict } = require('../http')

const router = express.Router()
const SUBMITTED_STATUSES = V.CANDIDATE_STATUSES.filter(s => s !== 'Draft')
const STATUS_MESSAGE = `Status must be one of: ${V.CANDIDATE_STATUSES.join(', ')}`
const EMAIL_TAKEN = 'A candidate with this email already exists'

const SORTS = {
  name: c => `${c.lastName} ${c.firstName}`.toLowerCase(),
  email: c => c.email,
  location: c => c.location.toLowerCase(),
  status: c => c.status,
  salary: c => c.salaryMin,
  createdAt: c => c.createdAt
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: V.MAX_CV_BYTES, files: 1 }
}).single('cv')

// Blank values (unfinished drafts) sort last in either direction
function compare(a, b, direction) {
  const blankA = a === null || a === ''
  const blankB = b === null || b === ''
  if (blankA || blankB) return blankA - blankB
  return direction * (typeof a === 'number' ? a - b : String(a).localeCompare(String(b)))
}

function findCandidate(req, res) {
  const id = parseId(req.params.id)
  const candidate = id === null ? undefined : db.candidates.find(c => c.id === id)
  if (!candidate) notFound(res, 'Candidate')
  return candidate
}

function emailTaken(email, exceptId) {
  return email !== '' && db.candidates.some(c => c.id !== exceptId && c.email === email)
}

// Keeps only known fields, and clears conditional fields that do not apply
function pickCandidate(body) {
  const rightToWork = text(body.rightToWork)
  const availability = text(body.availability)
  const roles = Array.isArray(body.employmentHistory) ? body.employmentHistory.filter(isObject) : []
  return {
    firstName: text(body.firstName),
    lastName: text(body.lastName),
    email: text(body.email).toLowerCase(),
    phone: text(body.phone),
    location: text(body.location),
    employmentHistory: roles.map(r => ({
      company: text(r.company),
      jobTitle: text(r.jobTitle),
      startDate: text(r.startDate),
      endDate: r.current === true ? '' : text(r.endDate),
      current: r.current === true
    })),
    skills: Array.isArray(body.skills) ? body.skills.map(text) : [],
    salaryMin: number(body.salaryMin),
    salaryMax: number(body.salaryMax),
    rightToWork,
    visaType: rightToWork === 'visa' ? text(body.visaType) : '',
    visaExpiry: rightToWork === 'visa' ? text(body.visaExpiry) : '',
    availability,
    noticePeriodWeeks: availability === 'notice' ? number(body.noticePeriodWeeks) : null,
    availableFrom: availability === 'date' ? text(body.availableFrom) : '',
    willingToRelocate: body.willingToRelocate === true
  }
}

function validateBody(body, draft) {
  const data = pickCandidate(body)
  const errors = V.validateCandidate(data, { draft })
  if (body.status !== undefined && !V.CANDIDATE_STATUSES.includes(body.status)) errors.status = STATUS_MESSAGE
  return { data, errors }
}

router.get('/', (req, res) => {
  const q = key => (typeof req.query[key] === 'string' ? req.query[key].trim() : '')
  const search = q('search').toLowerCase()
  const status = q('status')
  const skill = q('skill')
  const sort = q('sort') || 'name'
  const order = q('order') || 'asc'
  const page = q('page') === '' ? 1 : V.int(q('page'))
  const pageSize = q('pageSize') === '' ? 10 : V.int(q('pageSize'))

  const errors = {}
  if (status && !V.CANDIDATE_STATUSES.includes(status)) errors.status = STATUS_MESSAGE
  if (skill && !V.SKILLS.includes(skill)) errors.skill = 'Skill is not in the skills list'
  if (!SORTS[sort]) errors.sort = `Sort must be one of: ${Object.keys(SORTS).join(', ')}`
  if (order !== 'asc' && order !== 'desc') errors.order = 'Order must be asc or desc'
  if (!(page >= 1)) errors.page = 'Page must be a whole number of 1 or more'
  if (!(pageSize >= 1 && pageSize <= 100)) errors.pageSize = 'Page size must be a whole number between 1 and 100'
  if (hasErrors(errors)) return validationError(res, errors)

  const key = SORTS[sort]
  const direction = order === 'desc' ? -1 : 1
  const matches = db.candidates
    .filter(c => !search || `${c.firstName} ${c.lastName}`.toLowerCase().includes(search))
    .filter(c => !status || c.status === status)
    .filter(c => !skill || c.skills.includes(skill))
    .sort((a, b) => compare(key(a), key(b), direction) || a.id - b.id)

  const start = (page - 1) * pageSize
  res.json({
    data: matches.slice(start, start + pageSize),
    page,
    pageSize,
    total: matches.length,
    totalPages: Math.ceil(matches.length / pageSize)
  })
})

router.post('/', (req, res) => {
  const body = isObject(req.body) ? req.body : {}
  const { data, errors } = validateBody(body, body.status === 'Draft')
  if (hasErrors(errors)) return validationError(res, errors)
  if (emailTaken(data.email, null)) return conflict(res, EMAIL_TAKEN, { email: EMAIL_TAKEN })

  const now = new Date().toISOString()
  const status = body.status || 'Active'
  const candidate = {
    id: nextId('candidates'),
    ...data,
    status,
    cv: null,
    statusHistory: [{ status, changedAt: now, changedBy: req.session.user.name }],
    createdAt: now,
    updatedAt: now
  }
  db.candidates.push(candidate)
  res.status(201).location(`/api/candidates/${candidate.id}`).json(candidate)
})

router.get('/:id', (req, res) => {
  const candidate = findCandidate(req, res)
  if (candidate) res.json(candidate)
})

router.put('/:id', (req, res) => {
  const candidate = findCandidate(req, res)
  if (!candidate) return
  const body = isObject(req.body) ? req.body : {}
  const draft = body.status === 'Draft'
  if (draft && candidate.status !== 'Draft') {
    return conflict(res, 'A submitted candidate cannot be changed back to a draft')
  }
  const { data, errors } = validateBody(body, draft)
  if (hasErrors(errors)) return validationError(res, errors)
  if (emailTaken(data.email, candidate.id)) return conflict(res, EMAIL_TAKEN, { email: EMAIL_TAKEN })

  // Saving a draft without a status submits it
  const status = body.status || (candidate.status === 'Draft' ? 'Active' : candidate.status)
  Object.assign(candidate, data, { updatedAt: new Date().toISOString() })
  setCandidateStatus(candidate, status, req.session.user.name)
  res.json(candidate)
})

router.patch('/:id/status', (req, res) => {
  const candidate = findCandidate(req, res)
  if (!candidate) return
  const status = text(isObject(req.body) ? req.body.status : '')
  if (!status) return validationError(res, { status: 'Status is required' })
  if (!SUBMITTED_STATUSES.includes(status)) {
    return validationError(res, { status: `Status must be one of: ${SUBMITTED_STATUSES.join(', ')}` })
  }
  if (candidate.status === 'Draft') {
    return conflict(res, 'Complete the intake form before changing the status of a draft')
  }
  if (candidate.status === status) return conflict(res, `Candidate is already ${status}`)
  setCandidateStatus(candidate, status, req.session.user.name)
  res.json(candidate)
})

router.delete('/:id', requireAdmin, (req, res) => {
  const candidate = findCandidate(req, res)
  if (!candidate) return
  db.candidates = db.candidates.filter(c => c.id !== candidate.id)
  db.notes = db.notes.filter(n => n.candidateId !== candidate.id)
  db.applications = db.applications.filter(a => a.candidateId !== candidate.id)
  db.cvFiles.delete(candidate.id)
  res.status(204).end()
})

router.post('/:id/cv', (req, res) => {
  const candidate = findCandidate(req, res)
  if (!candidate) return
  upload(req, res, err => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return validationError(res, { cv: 'CV must be 2MB or smaller' }, 413)
      return validationError(res, { cv: 'Upload one file in a form field named "cv"' })
    }
    if (!req.file) return validationError(res, { cv: 'Choose a file to upload' })
    const problem = V.validateCvFile(req.file.originalname, req.file.size)
    if (problem) return validationError(res, { cv: problem.message }, problem.code === 'type' ? 415 : 400)

    db.cvFiles.set(candidate.id, req.file.buffer)
    candidate.cv = {
      filename: req.file.originalname,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.session.user.name
    }
    candidate.updatedAt = candidate.cv.uploadedAt
    res.json(candidate.cv)
  })
})

router.get('/:id/cv', (req, res) => {
  const candidate = findCandidate(req, res)
  if (!candidate) return
  const file = db.cvFiles.get(candidate.id)
  if (!candidate.cv || !file) return notFound(res, 'CV')
  res.attachment(candidate.cv.filename).send(file)
})

router.delete('/:id/cv', (req, res) => {
  const candidate = findCandidate(req, res)
  if (!candidate) return
  if (!candidate.cv) return notFound(res, 'CV')
  db.cvFiles.delete(candidate.id)
  candidate.cv = null
  candidate.updatedAt = new Date().toISOString()
  res.status(204).end()
})

router.use('/:id/notes', require('./notes'))

module.exports = router
