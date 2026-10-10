// Values the app offers in its dropdowns and option lists
const SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'SQL', 'React', 'Node.js',
  'AWS', 'Docker', 'Test Automation', 'Project Management', 'Sales', 'Marketing',
  'Accounting', 'Customer Service'
]
const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Placed', 'Rejected']
const RIGHT_TO_WORK_LABELS = {
  citizen: 'UK or Irish citizen',
  settled: 'Settled or pre-settled status',
  visa: 'Visa required'
}
const AVAILABILITY_LABELS = {
  immediate: 'Immediately',
  notice: 'After a notice period',
  date: 'From a specific date'
}

// Counts in data/seed.json, restored before every test
const SEED = { candidates: 32, jobs: 8, users: 4, pageSize: 10 }

module.exports = { SKILLS, STAGES, RIGHT_TO_WORK_LABELS, AVAILABILITY_LABELS, SEED }
