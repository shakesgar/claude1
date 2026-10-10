const fs = require('fs')
const path = require('path')

const SEED_PATH = path.join(__dirname, '..', 'data', 'seed.json')
const COLLECTIONS = ['users', 'candidates', 'jobs', 'applications', 'notes']

// All data lives in memory; restarting the server (or calling reset) restores the seed
const db = {}

function reset() {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'))
  db.counters = {}
  for (const name of COLLECTIONS) {
    db[name] = seed[name]
    db.counters[name] = db[name].reduce((max, item) => Math.max(max, item.id), 0) + 1
  }
  // Uploaded CV contents, keyed by candidate id
  db.cvFiles = new Map()
}

function nextId(collection) {
  return db.counters[collection]++
}

function counts() {
  return Object.fromEntries(COLLECTIONS.map(name => [name, db[name].length]))
}

function setCandidateStatus(candidate, status, changedBy) {
  if (candidate.status === status) return
  const now = new Date().toISOString()
  candidate.status = status
  candidate.statusHistory.push({ status, changedAt: now, changedBy })
  candidate.updatedAt = now
}

reset()

module.exports = { db, reset, nextId, counts, setCandidateStatus }
