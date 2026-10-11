// Turns Playwright's JSON results into a markdown summary for a GitHub Actions run.
// Usage: node scripts/ci-summary.js [results file]
// Writes to the file named by GITHUB_STEP_SUMMARY, or to the console when that is not set.
const fs = require('fs')
const path = require('path')

const resultsPath = process.argv[2] || path.join('test-results', 'results.json')
const REPORT_ARTIFACT = 'playwright-html-report'
const RESULTS_ARTIFACT = 'playwright-test-results'

function main() {
  let report
  try {
    report = JSON.parse(fs.readFileSync(resultsPath, 'utf8'))
  } catch (err) {
    // No results usually means the run stopped before any test started, so the cause is in the log
    write([
      '## Playwright results',
      '',
      `No results were found at \`${resultsPath}\` (${err.code || err.message}).`,
      'The run probably stopped before any test started. Check the log of the "Run Playwright tests" step.',
      ''
    ].join('\n'))
    return
  }
  write(render(report))
}

function render(report) {
  const tests = collectTests(report.suites || [])
  const count = (status) => tests.filter((test) => test.status === status).length
  const failed = count('unexpected')
  const flaky = count('flaky')
  const problems = tests.filter((test) => test.status === 'unexpected' || test.status === 'flaky')

  const lines = [
    `## Playwright results: ${failed ? `${failed} failed` : flaky ? `passed with ${flaky} flaky` : 'all passed'}`,
    '',
    '| Passed | Failed | Flaky | Skipped | Duration |',
    '|---|---|---|---|---|',
    `| ${count('expected')} | ${failed} | ${flaky} | ${count('skipped')} | ${formatDuration(report.stats && report.stats.duration)} |`,
    ''
  ]

  for (const error of report.errors || []) {
    lines.push(`**Error outside a test:** ${oneLine(error.message)}`, '')
  }

  if (problems.length) {
    lines.push(
      '### Failed and flaky tests',
      '',
      '| Result | Test | File | Project | Retries | Error |',
      '|---|---|---|---|---|---|',
      ...problems.map((test) => `| ${[
        test.status === 'flaky' ? 'Flaky' : 'Failed',
        cell(test.title),
        cell(`${test.file}:${test.line}`),
        cell(test.project),
        test.retries,
        cell(test.error)
      ].join(' | ')} |`),
      '',
      'A flaky test failed and then passed on a retry. It still needs investigating.',
      ''
    )
  }

  lines.push(
    '### Full report',
    '',
    `Download the **${REPORT_ARTIFACT}** artifact from the Artifacts section at the bottom of this page, unzip it and open \`index.html\`.`,
    `Traces and screenshots for failed tests are in **${RESULTS_ARTIFACT}**; they can also be opened from inside the HTML report.`,
    ''
  )
  return lines.join('\n')
}

// Flattens the nested suites (file > describe > describe ...) into one entry per test and project
function collectTests(suites, parents = []) {
  const tests = []
  for (const suite of suites) {
    // The top-level suite of each file is titled with the file name, which the File column already shows
    const titles = suite.title && suite.title !== suite.file ? [...parents, suite.title] : parents
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const results = test.results || []
        const firstFailure = results.find((result) => result.error || (result.errors && result.errors.length))
        tests.push({
          title: [...titles, spec.title].join(' › '),
          file: spec.file,
          line: spec.line,
          project: test.projectName,
          status: test.status,
          retries: Math.max(0, results.length - 1),
          error: firstFailure ? oneLine((firstFailure.error || firstFailure.errors[0]).message) : ''
        })
      }
    }
    tests.push(...collectTests(suite.suites || [], titles))
  }
  return tests
}

// First line of an error, without terminal colour codes, short enough for a table
function oneLine(message = '') {
  const first = message.replace(/\u001b\[[0-9;]*m/g, '').split('\n').find((line) => line.trim()) || ''
  const text = first.trim()
  return text.length > 200 ? `${text.slice(0, 197)}...` : text
}

// Keeps text from breaking out of a markdown table cell
function cell(text) {
  return String(text ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function formatDuration(ms) {
  if (typeof ms !== 'number') return 'unknown'
  const seconds = Math.round(ms / 1000)
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function write(markdown) {
  const target = process.env.GITHUB_STEP_SUMMARY
  if (target) fs.appendFileSync(target, `${markdown}\n`)
  else console.log(markdown)
}

main()
