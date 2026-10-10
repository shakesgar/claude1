const { test, expect } = require('../fixtures')
const { USERS } = require('../support/env')
const { buildNote, fullName, money } = require('../data/builders')
const { buildFile, MB } = require('../data/files')

test.describe('Candidate profile', { tag: '@regression' }, () => {
  test.describe('for a new candidate', () => {
    let candidate

    test.beforeEach(async ({ api, candidateProfilePage }) => {
      candidate = await api.createCandidate()
      await candidateProfilePage.goto(candidate.id)
      await expect(candidateProfilePage.name).toHaveText(fullName(candidate))
    })

    test('shows the candidate details', async ({ candidateProfilePage: profile }) => {
      await expect(profile.status).toHaveText('Active')
      await expect(profile.detail('email')).toHaveText(candidate.email)
      await expect(profile.detail('phone')).toHaveText(candidate.phone)
      await expect(profile.detail('location')).toHaveText(candidate.location)
      await expect(profile.detail('skills')).toHaveText(candidate.skills.join(', '))
      await expect(profile.detail('salary')).toHaveText(`${money(candidate.salaryMin)} – ${money(candidate.salaryMax)}`)
      await expect(profile.detail('rightToWork')).toHaveText('UK or Irish citizen')
      await expect(profile.detail('availability')).toHaveText('Immediately')
      await expect(profile.employmentItems).toHaveCount(1)
      await expect(profile.notesCount).toHaveText('0')
      await expect(profile.cvEmptyMessage).toHaveText('No CV uploaded.')
    })

    test.describe('notes', () => {
      test('adds a note', async ({ candidateProfilePage: profile }) => {
        const { text } = buildNote()
        await profile.addNote(text)

        await profile.toast.expectSuccess('Note added')
        await expect(profile.notes).toHaveCount(1)
        await expect(profile.note(text).getByTestId('note-author')).toHaveText(USERS.recruiter.name)
        await expect(profile.notesCount).toHaveText('1')
        await expect(profile.noteInput).toHaveValue('')
      })

      test('lists the newest note first', async ({ api, candidateProfilePage: profile, page }) => {
        await api.addNote(candidate.id, { text: 'Older note' })
        await page.reload()
        await expect(profile.notes).toHaveCount(1)

        await profile.addNote('Newer note')

        await expect(profile.notes.getByTestId('note-text')).toHaveText(['Newer note', 'Older note'])
      })

      test('requires note text', async ({ candidateProfilePage: profile }) => {
        await profile.addNoteButton.click()
        await expect(profile.noteError).toHaveText('Note text is required')

        await profile.addNote('   ')
        await expect(profile.noteError).toHaveText('Note text is required')
        await expect(profile.notes).toHaveCount(0)
      })

      test('limits a note to 1000 characters', async ({ candidateProfilePage: profile }) => {
        await profile.addNote('x'.repeat(1001))
        await expect(profile.noteError).toHaveText('Note must be 1000 characters or fewer')
        await expect(profile.notes).toHaveCount(0)

        await profile.addNote('x'.repeat(1000))
        await expect(profile.notes).toHaveCount(1)
        await expect(profile.noteError).toBeHidden()
      })

      test('edits a note', async ({ api, candidateProfilePage: profile, page }) => {
        const note = await api.addNote(candidate.id)
        await page.reload()

        await profile.editNote(note.text, 'Updated after the client call')

        await profile.toast.expectSuccess('Note updated')
        await expect(profile.notes.getByTestId('note-text')).toHaveText(['Updated after the client call'])
        await expect(profile.note('Updated after the client call').getByTestId('note-edited')).toBeVisible()
      })

      test('cancelling an edit keeps the original text', async ({ api, candidateProfilePage: profile, page }) => {
        const note = await api.addNote(candidate.id)
        await page.reload()

        await profile.startEditingNote(note.text)
        await profile.noteEditInput.fill('This should not be saved')
        await page.getByRole('button', { name: 'Cancel' }).click()

        await expect(profile.notes.getByTestId('note-text')).toHaveText([note.text])
        await expect(profile.noteEditInput).toHaveCount(0)
      })

      test('an edited note cannot be left empty', async ({ api, candidateProfilePage: profile, page }) => {
        const note = await api.addNote(candidate.id)
        await page.reload()

        await profile.editNote(note.text, '')

        await expect(profile.noteEditError).toHaveText('Note text is required')
      })

      test('deletes a note after confirmation', async ({ api, candidateProfilePage: profile, page }) => {
        const kept = await api.addNote(candidate.id)
        const removed = await api.addNote(candidate.id)
        await page.reload()
        await expect(profile.notes).toHaveCount(2)

        await profile.requestNoteDeletion(removed.text)
        await expect(profile.confirmDialog.title).toHaveText('Delete note')
        await profile.confirmDialog.accept()

        await profile.toast.expectSuccess('Note deleted')
        await expect(profile.notes.getByTestId('note-text')).toHaveText([kept.text])
        await expect(profile.notesCount).toHaveText('1')
      })

      test('cancelling the confirmation keeps the note', async ({ api, candidateProfilePage: profile, page }) => {
        const note = await api.addNote(candidate.id)
        await page.reload()

        await profile.requestNoteDeletion(note.text)
        await profile.confirmDialog.cancel()

        await expect(profile.notes).toHaveCount(1)
      })
    })

    test.describe('CV upload', () => {
      for (const name of ['sample-cv.pdf', 'sample-cv.docx', 'UPPERCASE.PDF']) {
        test(`accepts ${name}`, async ({ candidateProfilePage: profile }) => {
          await profile.uploadCv(buildFile(name))

          await profile.toast.expectSuccess(`CV uploaded: ${name}`)
          await expect(profile.cvLink).toHaveText(name)
          await expect(profile.cvDetails).toContainText('2 KB')
          await expect(profile.cvDetails).toContainText(USERS.recruiter.name)
          await expect(profile.cvInput).toHaveValue('')
        })
      }

      test('accepts a file of exactly 2MB', async ({ candidateProfilePage: profile }) => {
        await profile.uploadCv(buildFile('limit.pdf', 2 * MB))

        await expect(profile.cvLink).toHaveText('limit.pdf')
        await expect(profile.cvDetails).toContainText('2.0 MB')
      })

      const invalidFiles = [
        ['a text file', buildFile('notes.txt'), 'CV must be a PDF or DOCX file'],
        ['an image', buildFile('photo.png'), 'CV must be a PDF or DOCX file'],
        ['an old Word document', buildFile('legacy.doc'), 'CV must be a PDF or DOCX file'],
        ['a file with no extension', buildFile('resume'), 'CV must be a PDF or DOCX file'],
        ['a PDF over 2MB', buildFile('too-big.pdf', 2 * MB + 1), 'CV must be 2MB or smaller'],
        ['an empty PDF', buildFile('empty.pdf', 0), 'The selected file is empty']
      ]
      for (const [description, file, message] of invalidFiles) {
        test(`rejects ${description}`, async ({ candidateProfilePage: profile }) => {
          await profile.uploadCv(file)

          await expect(profile.cvError).toHaveText(message)
          await expect(profile.cvEmptyMessage).toBeVisible()
          await expect(profile.cvLink).toHaveCount(0)
        })
      }

      test('requires a file to be chosen', async ({ candidateProfilePage: profile }) => {
        await profile.uploadCvButton.click()

        await expect(profile.cvError).toHaveText('Choose a file to upload')
      })

      test('a new upload replaces the current CV', async ({ candidateProfilePage: profile }) => {
        await profile.uploadCv(buildFile('first.pdf'))
        await expect(profile.cvLink).toHaveText('first.pdf')

        await profile.uploadCv(buildFile('second.docx'))

        await expect(profile.cvLink).toHaveText('second.docx')
        await expect(profile.cvLink).toHaveCount(1)
      })

      test('a rejected upload keeps the current CV', async ({ candidateProfilePage: profile }) => {
        await profile.uploadCv(buildFile('current.pdf'))
        await expect(profile.cvLink).toHaveText('current.pdf')

        await profile.uploadCv(buildFile('notes.txt'))

        await expect(profile.cvError).toHaveText('CV must be a PDF or DOCX file')
        await expect(profile.cvLink).toHaveText('current.pdf')
      })

      test('the uploaded CV can be downloaded', async ({ candidateProfilePage: profile, page }) => {
        await profile.uploadCv(buildFile('download-me.pdf', 4096))
        await expect(profile.cvLink).toBeVisible()

        const [download] = await Promise.all([page.waitForEvent('download'), profile.cvLink.click()])

        expect(download.suggestedFilename()).toBe('download-me.pdf')
      })

      test('removes the CV after confirmation', async ({ candidateProfilePage: profile }) => {
        await profile.uploadCv(buildFile('remove-me.pdf'))
        await expect(profile.cvLink).toBeVisible()

        await profile.removeCv()

        await profile.toast.expectSuccess('CV removed')
        await expect(profile.cvEmptyMessage).toBeVisible()
        await expect(profile.cvLink).toHaveCount(0)
      })
    })
  })

  test.describe('note ownership', () => {
    // Seeded candidate 1 has one note by Riley Recruiter and one by Alex Admin
    const OWN_NOTE = 'Strong communicator'
    const ADMIN_NOTE = 'Reference check completed'

    test('a recruiter can change only their own notes', async ({ candidateProfilePage: profile }) => {
      await profile.goto(1)
      await expect(profile.notes).toHaveCount(2)

      await expect(profile.note(OWN_NOTE).getByRole('button', { name: 'Edit' })).toBeVisible()
      await expect(profile.note(OWN_NOTE).getByRole('button', { name: 'Delete' })).toBeVisible()
      await expect(profile.note(ADMIN_NOTE).getByRole('button')).toHaveCount(0)
    })

    test.describe('as an admin', () => {
      test.use({ role: 'admin' })

      test('an admin can change any note', async ({ candidateProfilePage: profile }) => {
        await profile.goto(1)
        await expect(profile.notes).toHaveCount(2)

        await profile.editNote(OWN_NOTE, 'Reworded by an admin')
        await expect(profile.note('Reworded by an admin').getByTestId('note-author')).toHaveText(USERS.recruiter.name)

        await profile.deleteNote(ADMIN_NOTE)
        await expect(profile.notes).toHaveCount(1)
      })
    })
  })

  test('an unknown candidate shows a not-found message', async ({ candidateProfilePage: profile }) => {
    await profile.goto(99999)

    await expect(profile.notFoundMessage).toHaveText('Candidate not found.')
    await expect(profile.name).toBeHidden()
  })
})
