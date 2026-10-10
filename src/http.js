const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const hasErrors = errors => Object.keys(errors).length > 0

// Trimmed string for string/number input, '' for anything else
function text(v) {
  if (typeof v === 'string') return v.trim()
  return typeof v === 'number' ? String(v) : ''
}

// null when blank, otherwise a number (NaN when it is not numeric)
function number(v) {
  const s = text(v)
  return s === '' ? null : Number(s)
}

function parseId(v) {
  return /^\d{1,9}$/.test(String(v)) ? Number(v) : null
}

function validationError(res, errors, status = 400) {
  return res.status(status).json({ error: 'Validation failed', errors })
}

function notFound(res, what) {
  return res.status(404).json({ error: `${what} not found` })
}

function conflict(res, message, errors) {
  return res.status(409).json(errors ? { error: message, errors } : { error: message })
}

module.exports = { isObject, hasErrors, text, number, parseId, validationError, notFound, conflict }
