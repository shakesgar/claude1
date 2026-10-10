const { faker } = require('@faker-js/faker')
const { SKILLS } = require('./constants')

// Local calendar date as YYYY-MM-DD, offset from today (the app validates against local dates)
function isoDate(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// The app allows letters, spaces, hyphens and apostrophes in names
function personName(generate) {
  const name = generate().replace(/[^A-Za-z' -]/g, '')
  return name.length >= 2 ? name : 'Sample'
}

function buildRole(overrides = {}) {
  return {
    company: faker.company.name().slice(0, 100),
    jobTitle: faker.person.jobTitle().slice(0, 100),
    startDate: isoDate(-faker.number.int({ min: 400, max: 2000 })),
    endDate: '',
    current: true,
    ...overrides
  }
}

// A complete, valid candidate. Pass overrides to change individual fields.
function buildCandidate(overrides = {}) {
  const firstName = personName(() => faker.person.firstName())
  const lastName = personName(() => faker.person.lastName())
  const emailName = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, '')
  const salaryMin = faker.number.int({ min: 20, max: 80 }) * 1000
  const chosen = faker.helpers.arrayElements(SKILLS, { min: 1, max: 4 })
  return {
    firstName,
    lastName,
    // example.com is reserved for documentation, and 07700 900xxx is reserved for fiction
    email: `${emailName}.${faker.string.alphanumeric({ length: 6, casing: 'lower' })}@example.com`,
    phone: `07700 900${faker.string.numeric(3)}`,
    location: faker.location.city(),
    employmentHistory: [buildRole()],
    // Kept in the app's display order so UI text can be compared directly
    skills: SKILLS.filter(skill => chosen.includes(skill)),
    salaryMin,
    salaryMax: salaryMin + faker.number.int({ min: 1, max: 15 }) * 1000,
    rightToWork: 'citizen',
    visaType: '',
    visaExpiry: '',
    availability: 'immediate',
    noticePeriodWeeks: '',
    availableFrom: '',
    willingToRelocate: false,
    ...overrides
  }
}

function buildJob(overrides = {}) {
  const salaryMin = faker.number.int({ min: 25, max: 70 }) * 1000
  return {
    title: `${faker.person.jobTitle()} ${faker.string.alphanumeric({ length: 4, casing: 'upper' })}`.slice(0, 100),
    client: faker.company.name().slice(0, 100),
    location: faker.location.city(),
    salaryMin,
    salaryMax: salaryMin + faker.number.int({ min: 2, max: 20 }) * 1000,
    status: 'Open',
    description: faker.lorem.sentence(),
    ...overrides
  }
}

function buildNote(overrides = {}) {
  return { text: faker.lorem.sentence(), ...overrides }
}

const fullName = candidate => `${candidate.firstName} ${candidate.lastName}`
const money = amount => `£${Number(amount).toLocaleString('en-GB')}`

module.exports = { buildCandidate, buildRole, buildJob, buildNote, isoDate, fullName, money }
