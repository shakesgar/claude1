const express = require('express')
const V = require('../../public/js/validators')
const { db, nextId } = require('../store')
const { isObject, hasErrors, text, parseId, validationError, notFound } = require('../http')

// Mounted at /api/candidates/:id/notes
const router = express.Router({ mergeParams: true })

function findCandidate(req, res) {
  const id = parseId(req.params.id)
  const candidate = id === null ? undefined : db.candidates.find(c => c.id === id)
  if (!candidate) notFound(res, 'Candidate')
  return candidate
}

function findNote(req, res, candidate) {
  const id = parseId(req.params.noteId)
  const note = id === null ? undefined : db.notes.find(n => n.id === id && n.candidateId === candidate.id)
  if (!note) notFound(res, 'Note')
  return note
}

// Notes can be changed by their author or by an admin
function canModify(user, note) {
  return user.role === 'admin' || note.authorId === user.id
}

router.get('/', (req, res) => {
  const candidate = findCandidate(req, res)
  if (!candidate) return
  const data = db.notes
    .filter(n => n.candidateId === candidate.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
  res.json({ data, total: data.length })
})

router.post('/', (req, res) => {
  const candidate = findCandidate(req, res)
  if (!candidate) return
  const noteText = text(isObject(req.body) ? req.body.text : '')
  const errors = V.validateNote({ text: noteText })
  if (hasErrors(errors)) return validationError(res, errors)

  const now = new Date().toISOString()
  const note = {
    id: nextId('notes'),
    candidateId: candidate.id,
    text: noteText,
    authorId: req.session.user.id,
    authorName: req.session.user.name,
    createdAt: now,
    updatedAt: now
  }
  db.notes.push(note)
  res.status(201).json(note)
})

router.put('/:noteId', (req, res) => {
  const candidate = findCandidate(req, res)
  if (!candidate) return
  const note = findNote(req, res, candidate)
  if (!note) return
  if (!canModify(req.session.user, note)) {
    return res.status(403).json({ error: 'Only the author or an admin can edit this note' })
  }
  const noteText = text(isObject(req.body) ? req.body.text : '')
  const errors = V.validateNote({ text: noteText })
  if (hasErrors(errors)) return validationError(res, errors)

  note.text = noteText
  note.updatedAt = new Date().toISOString()
  res.json(note)
})

router.delete('/:noteId', (req, res) => {
  const candidate = findCandidate(req, res)
  if (!candidate) return
  const note = findNote(req, res, candidate)
  if (!note) return
  if (!canModify(req.session.user, note)) {
    return res.status(403).json({ error: 'Only the author or an admin can delete this note' })
  }
  db.notes = db.notes.filter(n => n.id !== note.id)
  res.status(204).end()
})

module.exports = router
