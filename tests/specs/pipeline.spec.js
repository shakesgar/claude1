const { test, expect } = require('../fixtures')
const { USERS } = require('../support/env')
const { STAGES } = require('../data/constants')
const { fullName } = require('../data/builders')

// Seeded open job that the tests assign new candidates to
const JOB = { id: 2, title: 'QA Automation Engineer', label: 'QA Automation Engineer (Bluebird Sample Co)' }

test.describe('Pipeline', { tag: '@regression' }, () => {
  let candidate
  let name
  let application

  test.beforeEach(async ({ api }) => {
    candidate = await api.createCandidate()
    name = fullName(candidate)
    application = await api.assign(candidate.id, JOB.id)
  })

  test('moves a candidate through every stage to Placed', async ({ api, pipelinePage, candidateProfilePage }) => {
    await pipelinePage.goto(JOB.id)
    await expect(pipelinePage.cardInColumn('Applied', name)).toBeVisible()

    let from = 'Applied'
    for (const stage of ['Screening', 'Interview', 'Offer', 'Placed']) {
      await test.step(`${from} to ${stage}`, async () => {
        await pipelinePage.requestMove(name, stage)
        await expect(pipelinePage.confirmDialog.title).toHaveText('Confirm stage change')
        await expect(pipelinePage.confirmDialog.message).toContainText(`Move ${name} from ${from} to ${stage} for ${JOB.title}?`)
        await pipelinePage.confirmDialog.accept()

        await expect(pipelinePage.cardInColumn(stage, name)).toBeVisible()
        await expect(pipelinePage.cardInColumn(from, name)).toHaveCount(0)
        await pipelinePage.toast.expectSuccess(`${name} moved to ${stage}`)
      })
      from = stage
    }

    await test.step('Placed is final', async () => {
      await expect(pipelinePage.card(name).getByTestId('pipeline-card-final')).toHaveText('Final stage')
      await expect(pipelinePage.stageSelect(name)).toHaveCount(0)
    })

    await test.step('the stage history records each move', async () => {
      const saved = await api.getApplication(application.id)
      expect(saved.history.map(entry => entry.stage)).toEqual(['Applied', 'Screening', 'Interview', 'Offer', 'Placed'])
      expect(new Set(saved.history.map(entry => entry.changedBy))).toEqual(new Set([USERS.recruiter.name]))
    })

    await test.step('the candidate status history shows the placement', async () => {
      await candidateProfilePage.goto(candidate.id)
      await expect(candidateProfilePage.status).toHaveText('Placed')
      await candidateProfilePage.expectStatusHistory(['Placed', 'Active'])
      await expect(candidateProfilePage.statusHistory.rows.first().getByTestId('status-history-user')).toHaveText(USERS.recruiter.name)
      await expect(candidateProfilePage.applications.row(JOB.title).getByTestId('application-stage')).toHaveText('Placed')
    })
  })

  test('the confirmation warns before a final stage', async ({ pipelinePage }) => {
    await pipelinePage.goto(JOB.id)
    await pipelinePage.requestMove(name, 'Rejected')

    await expect(pipelinePage.confirmDialog.message).toContainText('This is a final stage and cannot be changed afterwards.')
    await expect(pipelinePage.confirmDialog.acceptButton).toHaveText('Move to Rejected')
  })

  test('a rejected candidate cannot be moved again', async ({ pipelinePage, candidateProfilePage }) => {
    await pipelinePage.goto(JOB.id)
    await pipelinePage.moveTo(name, 'Rejected')

    await expect(pipelinePage.card(name).getByTestId('pipeline-card-final')).toBeVisible()
    await expect(pipelinePage.moveButton(name)).toHaveCount(0)

    // Unlike a placement, a rejection leaves the candidate's own status alone
    await candidateProfilePage.goto(candidate.id)
    await expect(candidateProfilePage.status).toHaveText('Active')
    await candidateProfilePage.expectStatusHistory(['Active'])
  })

  test('cancelling the confirmation leaves the candidate where they were', async ({ api, pipelinePage }) => {
    await pipelinePage.goto(JOB.id)
    await pipelinePage.requestMove(name, 'Offer')
    await pipelinePage.confirmDialog.cancel()

    await expect(pipelinePage.cardInColumn('Applied', name)).toBeVisible()
    await expect(pipelinePage.stageSelect(name)).toHaveValue('Applied')
    expect((await api.getApplication(application.id)).stage).toBe('Applied')
  })

  test('choosing the current stage is rejected', async ({ pipelinePage }) => {
    await pipelinePage.goto(JOB.id)
    await pipelinePage.moveButton(name).click()

    await pipelinePage.toast.expectError(`${name} is already at the Applied stage. Choose a different stage.`)
    await expect(pipelinePage.confirmDialog.root).toBeHidden()
  })

  test('stages can be skipped and moved backwards before a final stage', async ({ pipelinePage }) => {
    await pipelinePage.goto(JOB.id)

    await pipelinePage.moveTo(name, 'Offer')
    await pipelinePage.moveTo(name, 'Screening')

    await expect(pipelinePage.cardInColumn('Screening', name)).toBeVisible()
  })

  test('column counts follow the cards', async ({ pipelinePage }) => {
    await pipelinePage.goto(JOB.id)
    const applied = Number(await pipelinePage.columnCount('Applied').textContent())
    const screening = Number(await pipelinePage.columnCount('Screening').textContent())

    await pipelinePage.moveTo(name, 'Screening')

    await expect(pipelinePage.columnCount('Applied')).toHaveText(String(applied - 1))
    await expect(pipelinePage.columnCount('Screening')).toHaveText(String(screening + 1))
  })

  test('removes a candidate from a job after confirmation', async ({ pipelinePage }) => {
    await pipelinePage.goto(JOB.id)
    await pipelinePage.removeButton(name).click()
    await expect(pipelinePage.confirmDialog.message).toHaveText(`Remove ${name} from ${JOB.title}?`)
    await pipelinePage.confirmDialog.accept()

    await pipelinePage.toast.expectSuccess(`${name} removed from ${JOB.title}`)
    await expect(pipelinePage.card(name)).toHaveCount(0)
  })

  test('shows a column for every stage and filters by job', async ({ pipelinePage, page }) => {
    await pipelinePage.goto()
    for (const stage of STAGES) await expect(pipelinePage.column(stage)).toBeVisible()
    await expect(pipelinePage.resultCount).toHaveText('26 candidate-job pairings')

    await pipelinePage.filterByJob(JOB.label)

    await expect(page).toHaveURL(new RegExp(`\\?jobId=${JOB.id}$`))
    const jobs = await pipelinePage.cards.getByTestId('pipeline-card-job').allTextContents()
    expect(jobs.length).toBeGreaterThan(1)
    expect(new Set(jobs)).toEqual(new Set([JOB.title]))
    await expect(pipelinePage.resultCount).toHaveText(`${jobs.length} candidate-job pairings`)
    await expect(pipelinePage.card(name)).toBeVisible()
  })

  test.describe('from the candidate profile', () => {
    test('a candidate can be assigned to another open job', async ({ candidateProfilePage, pipelinePage }) => {
      const other = { id: 3, title: 'Data Analyst', label: 'Data Analyst (Redbrick Test Group)' }
      await candidateProfilePage.goto(candidate.id)
      await expect(candidateProfilePage.applications.rows).toHaveCount(1)

      await candidateProfilePage.assignToJob(other.label)

      await candidateProfilePage.toast.expectSuccess(`Assigned to ${other.title} at the Applied stage`)
      await expect(candidateProfilePage.applications.rows).toHaveCount(2)
      await expect(candidateProfilePage.applications.row(other.title).getByTestId('application-stage')).toHaveText('Applied')
      // A job the candidate is already on is no longer offered
      await expect(candidateProfilePage.assignJobSelect.getByRole('option', { name: other.label })).toHaveCount(0)

      await pipelinePage.goto(other.id)
      await expect(pipelinePage.cardInColumn('Applied', name)).toBeVisible()
    })

    test('assigning requires a job to be chosen', async ({ candidateProfilePage }) => {
      await candidateProfilePage.goto(candidate.id)
      await expect(candidateProfilePage.applications.rows).toHaveCount(1)
      await candidateProfilePage.assignJobButton.click()

      await expect(candidateProfilePage.assignJobError).toHaveText('Select a job to assign')
    })

    test('a status change is confirmed and added to the status history', async ({ candidateProfilePage: profile }) => {
      await profile.goto(candidate.id)
      await profile.expectStatusHistory(['Active'])

      await profile.changeStatus('Interviewing')
      await expect(profile.confirmDialog.message).toHaveText('Change status from Active to Interviewing?')
      await profile.confirmDialog.accept()

      await profile.toast.expectSuccess('Status changed to Interviewing')
      await expect(profile.status).toHaveText('Interviewing')
      await profile.expectStatusHistory(['Interviewing', 'Active'])

      await profile.changeStatus('Unavailable')
      await profile.confirmDialog.accept()
      await profile.expectStatusHistory(['Unavailable', 'Interviewing', 'Active'])
    })

    test('cancelling a status change keeps the current status', async ({ candidateProfilePage: profile }) => {
      await profile.goto(candidate.id)
      await profile.changeStatus('Unavailable')
      await profile.confirmDialog.cancel()

      await expect(profile.status).toHaveText('Active')
      await expect(profile.statusSelect).toHaveValue('Active')
      await profile.expectStatusHistory(['Active'])
    })

    test('choosing the current status is rejected', async ({ candidateProfilePage: profile }) => {
      await profile.goto(candidate.id)
      await expect(profile.statusSelect).toHaveValue('Active')
      await profile.updateStatusButton.click()

      await expect(profile.statusError).toHaveText('Candidate is already Active. Choose a different status.')
      await expect(profile.confirmDialog.root).toBeHidden()
    })
  })
})
