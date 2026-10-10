const { test, expect } = require('../fixtures')
const { buildCandidate, buildJob, fullName, money } = require('../data/builders')

test.describe('API and UI together', { tag: '@regression' }, () => {
  test('data created through the API appears throughout the UI', async ({ api, candidateListPage, candidateProfilePage, jobsPage, pipelinePage, page }) => {
    // Arrange through the API: a job, a candidate, a note, and a pairing moved to Interview
    const job = await api.createJob()
    const candidate = await api.createCandidate(buildCandidate({ skills: ['SQL', 'Test Automation'] }))
    const note = await api.addNote(candidate.id)
    const application = await api.assign(candidate.id, job.id)
    await api.moveTo(application.id, 'Interview')
    const name = fullName(candidate)

    await test.step('the candidate list finds the candidate', async () => {
      await candidateListPage.goto()
      await candidateListPage.filterBySkill('Test Automation')
      await candidateListPage.search(name)

      await expect(candidateListPage.table.rows).toHaveCount(1)
      await expect(candidateListPage.table.row(name).getByTestId('candidate-email')).toHaveText(candidate.email)
      await expect(candidateListPage.table.row(name).getByTestId('candidate-status')).toHaveText('Active')
    })

    await test.step('the profile shows the details, note and job', async () => {
      await candidateListPage.openCandidate(name)

      await expect(page).toHaveURL(new RegExp(`/candidates/${candidate.id}$`))
      await expect(candidateProfilePage.name).toHaveText(name)
      await expect(candidateProfilePage.detail('skills')).toHaveText('SQL, Test Automation')
      await expect(candidateProfilePage.notes.getByTestId('note-text')).toHaveText([note.text])
      await expect(candidateProfilePage.applications.row(job.title).getByTestId('application-stage')).toHaveText('Interview')
    })

    await test.step('the jobs list and job page show the job and its candidate', async () => {
      await jobsPage.goto()
      await jobsPage.search(job.title)
      await expect(jobsPage.table.rows).toHaveCount(1)
      await expect(jobsPage.table.row(job.title).getByTestId('job-client')).toHaveText(job.client)
      await expect(jobsPage.table.row(job.title).getByTestId('job-candidate-count')).toHaveText('1')

      await jobsPage.table.row(job.title).getByRole('link', { name: job.title, exact: true }).click()
      await expect(jobsPage.title).toHaveText(job.title)
      await expect(jobsPage.status).toHaveText('Open')
      await expect(jobsPage.detail('salary')).toHaveText(`${money(job.salaryMin)} – ${money(job.salaryMax)}`)
      await expect(jobsPage.candidates.row(name).getByTestId('job-candidate-stage')).toHaveText('Interview')
    })

    await test.step('the pipeline shows the pairing in the Interview column', async () => {
      await pipelinePage.goto(job.id)

      await expect(pipelinePage.cards).toHaveCount(1)
      await expect(pipelinePage.cardInColumn('Interview', name)).toBeVisible()
    })
  })

  test('a job created in the UI is returned by the API', async ({ jobsPage, page, request }) => {
    const job = buildJob({ status: 'On Hold' })

    await jobsPage.createJob(job)
    await jobsPage.toast.expectSuccess('Job created')
    await expect(jobsPage.assignUnavailableMessage).toBeVisible()

    const id = page.url().split('/').pop()
    const response = await request.get(`/api/jobs/${id}`)
    expect(response.status()).toBe(200)
    expect(await response.json()).toMatchObject({
      title: job.title, client: job.client, salaryMin: job.salaryMin, salaryMax: job.salaryMax, status: 'On Hold', applicationCount: 0
    })
  })
})
