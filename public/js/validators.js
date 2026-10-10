// Validation rules shared by the browser (window.Validators) and the server (require)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.Validators = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  const SKILLS = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'SQL', 'React', 'Node.js',
    'AWS', 'Docker', 'Test Automation', 'Project Management', 'Sales', 'Marketing',
    'Accounting', 'Customer Service'
  ]
  const CANDIDATE_STATUSES = ['Draft', 'Active', 'Interviewing', 'Placed', 'Unavailable']
  const JOB_STATUSES = ['Draft', 'Open', 'On Hold', 'Closed']
  const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Placed', 'Rejected']
  const FINAL_STAGES = ['Placed', 'Rejected']
  const RIGHT_TO_WORK = ['citizen', 'settled', 'visa']
  const RIGHT_TO_WORK_LABELS = {
    citizen: 'UK or Irish citizen',
    settled: 'Settled or pre-settled status',
    visa: 'Visa required'
  }
  const AVAILABILITY = ['immediate', 'notice', 'date']
  const AVAILABILITY_LABELS = {
    immediate: 'Immediately',
    notice: 'After a notice period',
    date: 'From a specific date'
  }
  const SALARY_MIN = 10000
  const SALARY_MAX = 500000
  const SALARY_RANGE = 'between £10,000 and £500,000'
  const MAX_ROLES = 10
  const MAX_SKILLS = 10
  const MAX_NOTE_LENGTH = 1000
  const MAX_CV_BYTES = 2 * 1024 * 1024
  const CV_EXTENSIONS = ['.pdf', '.docx']

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  const PHONE_RE = /^\+?[0-9][0-9 ()-]*$/
  const NAME_RE = /^[A-Za-zÀ-ÿ' -]+$/
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

  const blank = v => v === undefined || v === null || String(v).trim() === ''
  const str = v => (blank(v) ? '' : String(v).trim())

  function today() {
    const d = new Date()
    const p = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }

  function addMonths(dateStr, months) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10)
  }

  function isDate(v) {
    if (!DATE_RE.test(v)) return false
    const d = new Date(v + 'T00:00:00Z')
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
  }

  // null when blank, NaN when not a whole number
  function int(v) {
    if (blank(v)) return null
    const n = Number(v)
    return Number.isInteger(n) ? n : NaN
  }

  function checkName(errors, key, label, value) {
    const v = str(value)
    if (!v) errors[key] = `${label} is required`
    else if (v.length < 2 || v.length > 50) errors[key] = `${label} must be between 2 and 50 characters`
    else if (!NAME_RE.test(v)) errors[key] = `${label} can only contain letters, spaces, hyphens and apostrophes`
  }

  function checkText(errors, key, label, value, min, max, required) {
    const v = str(value)
    if (!v) {
      if (required) errors[key] = `${label} is required`
    } else if (v.length < min || v.length > max) {
      errors[key] = `${label} must be between ${min} and ${max} characters`
    }
  }

  function checkSalaryRange(errors, d, required) {
    const min = int(d.salaryMin)
    const max = int(d.salaryMax)
    if (min === null) {
      if (required) errors.salaryMin = 'Minimum salary is required'
    } else if (Number.isNaN(min)) errors.salaryMin = 'Minimum salary must be a whole number'
    else if (min < SALARY_MIN || min > SALARY_MAX) errors.salaryMin = `Minimum salary must be ${SALARY_RANGE}`

    if (max === null) {
      if (required) errors.salaryMax = 'Maximum salary is required'
    } else if (Number.isNaN(max)) errors.salaryMax = 'Maximum salary must be a whole number'
    else if (max < SALARY_MIN || max > SALARY_MAX) errors.salaryMax = `Maximum salary must be ${SALARY_RANGE}`
    else if (min !== null && !Number.isNaN(min) && max < min) {
      errors.salaryMax = 'Maximum salary must be greater than or equal to minimum salary'
    }
  }

  // In draft mode only the name is required; anything else filled in must still be valid
  function validatePersonal(d, opts) {
    const required = !(opts && opts.draft)
    const errors = {}
    checkName(errors, 'firstName', 'First name', d.firstName)
    checkName(errors, 'lastName', 'Last name', d.lastName)

    const email = str(d.email)
    if (!email) {
      if (required) errors.email = 'Email is required'
    } else if (email.length > 254 || !EMAIL_RE.test(email)) {
      errors.email = 'Enter a valid email address, like name@example.com'
    }

    const phone = str(d.phone)
    const digits = phone.replace(/\D/g, '').length
    if (!phone) {
      if (required) errors.phone = 'Phone number is required'
    } else if (!PHONE_RE.test(phone) || digits < 7 || digits > 15) {
      errors.phone = 'Enter a valid phone number with 7 to 15 digits'
    }

    checkText(errors, 'location', 'Location', d.location, 2, 100, required)
    return errors
  }

  function validateEmployment(d, opts) {
    const required = !(opts && opts.draft)
    const errors = {}
    const roles = Array.isArray(d.employmentHistory) ? d.employmentHistory : []
    const t = today()
    if (roles.length === 0 && required) errors.employmentHistory = 'Add at least one role'
    if (roles.length > MAX_ROLES) errors.employmentHistory = `Add no more than ${MAX_ROLES} roles`

    roles.forEach((role, i) => {
      const r = role || {}
      const key = f => `employmentHistory.${i}.${f}`
      checkText(errors, key('company'), 'Company', r.company, 2, 100, required)
      checkText(errors, key('jobTitle'), 'Job title', r.jobTitle, 2, 100, required)

      const start = str(r.startDate)
      const end = str(r.endDate)
      let startOk = false
      if (!start) {
        if (required) errors[key('startDate')] = 'Start date is required'
      } else if (!isDate(start)) errors[key('startDate')] = 'Enter a valid start date'
      else if (start > t) errors[key('startDate')] = 'Start date cannot be in the future'
      else startOk = true

      if (r.current === true) return
      if (!end) {
        if (required) errors[key('endDate')] = 'End date is required unless this is a current role'
      } else if (!isDate(end)) errors[key('endDate')] = 'Enter a valid end date'
      else if (end > t) errors[key('endDate')] = 'End date cannot be in the future'
      else if (startOk && end < start) errors[key('endDate')] = 'End date must be on or after the start date'
    })
    return errors
  }

  function validateSkillsSalary(d, opts) {
    const required = !(opts && opts.draft)
    const errors = {}
    const skills = Array.isArray(d.skills) ? d.skills : []
    if (skills.length === 0) {
      if (required) errors.skills = 'Select at least one skill'
    } else if (skills.length > MAX_SKILLS) errors.skills = `Select no more than ${MAX_SKILLS} skills`
    else if (skills.some(s => !SKILLS.includes(s))) errors.skills = 'Select skills from the list'
    checkSalaryRange(errors, d, required)
    return errors
  }

  function validateRightToWork(d, opts) {
    const required = !(opts && opts.draft)
    const errors = {}
    const t = today()

    const rtw = str(d.rightToWork)
    if (!rtw) {
      if (required) errors.rightToWork = 'Select a right to work option'
    } else if (!RIGHT_TO_WORK.includes(rtw)) errors.rightToWork = 'Select a valid right to work option'

    if (rtw === 'visa') {
      checkText(errors, 'visaType', 'Visa type', d.visaType, 2, 50, required)
      const expiry = str(d.visaExpiry)
      if (!expiry) {
        if (required) errors.visaExpiry = 'Visa expiry date is required'
      } else if (!isDate(expiry)) errors.visaExpiry = 'Enter a valid visa expiry date'
      else if (expiry <= t) errors.visaExpiry = 'Visa expiry date must be in the future'
    }

    const availability = str(d.availability)
    if (!availability) {
      if (required) errors.availability = 'Select an availability option'
    } else if (!AVAILABILITY.includes(availability)) errors.availability = 'Select a valid availability option'

    if (availability === 'notice') {
      const weeks = int(d.noticePeriodWeeks)
      if (weeks === null) {
        if (required) errors.noticePeriodWeeks = 'Notice period is required'
      } else if (Number.isNaN(weeks)) errors.noticePeriodWeeks = 'Notice period must be a whole number of weeks'
      else if (weeks < 1 || weeks > 26) errors.noticePeriodWeeks = 'Notice period must be between 1 and 26 weeks'
    }

    if (availability === 'date') {
      const from = str(d.availableFrom)
      if (!from) {
        if (required) errors.availableFrom = 'Available from date is required'
      } else if (!isDate(from)) errors.availableFrom = 'Enter a valid available from date'
      else if (from < t) errors.availableFrom = 'Available from date cannot be in the past'
      else if (from > addMonths(t, 12)) errors.availableFrom = 'Available from date must be within the next 12 months'
    }
    return errors
  }

  function validateCandidate(d, opts) {
    return Object.assign(
      {},
      validatePersonal(d, opts),
      validateEmployment(d, opts),
      validateSkillsSalary(d, opts),
      validateRightToWork(d, opts)
    )
  }

  function validateJob(d) {
    const errors = {}
    checkText(errors, 'title', 'Job title', d.title, 3, 100, true)
    checkText(errors, 'client', 'Client', d.client, 2, 100, true)
    checkText(errors, 'location', 'Location', d.location, 2, 100, false)
    checkSalaryRange(errors, d, true)
    const status = str(d.status)
    if (!status) errors.status = 'Status is required'
    else if (!JOB_STATUSES.includes(status)) errors.status = `Status must be one of: ${JOB_STATUSES.join(', ')}`
    if (str(d.description).length > 2000) errors.description = 'Description must be 2000 characters or fewer'
    return errors
  }

  function validateNote(d) {
    const errors = {}
    const text = str(d.text)
    if (!text) errors.text = 'Note text is required'
    else if (text.length > MAX_NOTE_LENGTH) errors.text = `Note must be ${MAX_NOTE_LENGTH} characters or fewer`
    return errors
  }

  function validateLogin(d) {
    const errors = {}
    const email = str(d.email)
    if (!email) errors.email = 'Email is required'
    else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address, like name@example.com'
    if (blank(d.password)) errors.password = 'Password is required'
    return errors
  }

  // Returns null when the file is acceptable, otherwise { code, message }
  function validateCvFile(name, size) {
    const ext = String(name || '').toLowerCase().match(/\.[^.]+$/)
    if (!ext || !CV_EXTENSIONS.includes(ext[0])) {
      return { code: 'type', message: 'CV must be a PDF or DOCX file' }
    }
    if (size === 0) return { code: 'empty', message: 'The selected file is empty' }
    if (size > MAX_CV_BYTES) return { code: 'size', message: 'CV must be 2MB or smaller' }
    return null
  }

  return {
    SKILLS, CANDIDATE_STATUSES, JOB_STATUSES, STAGES, FINAL_STAGES,
    RIGHT_TO_WORK, RIGHT_TO_WORK_LABELS, AVAILABILITY, AVAILABILITY_LABELS,
    SALARY_MIN, SALARY_MAX, MAX_NOTE_LENGTH, MAX_CV_BYTES, CV_EXTENSIONS,
    int, today,
    validatePersonal, validateEmployment, validateSkillsSalary, validateRightToWork,
    validateCandidate, validateJob, validateNote, validateLogin, validateCvFile
  }
})
