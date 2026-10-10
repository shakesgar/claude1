const { expect } = require('@playwright/test')
const { Table } = require('../components/table')
const { Toast } = require('../components/toast')
const { ConfirmDialog } = require('../components/confirm-dialog')

class CandidateProfilePage {
  constructor(page) {
    this.page = page
    this.toast = new Toast(page)
    this.confirmDialog = new ConfirmDialog(page)

    this.name = page.getByRole('heading', { level: 1 })
    this.status = page.getByTestId('candidate-status')
    this.notFoundMessage = page.getByTestId('candidate-not-found')
    this.draftBanner = page.getByTestId('draft-banner')
    this.continueDraftLink = page.getByRole('link', { name: 'Continue the intake form' })
    this.deleteButton = page.getByRole('button', { name: 'Delete candidate' })
    this.employmentItems = page.getByTestId('employment-item')

    // Notes
    this.noteInput = page.getByLabel('Add a note')
    this.addNoteButton = page.getByRole('button', { name: 'Add note' })
    this.noteError = page.getByTestId('note-error')
    this.notes = page.getByTestId('note-item')
    this.notesCount = page.getByTestId('notes-count')
    this.noteEditInput = page.getByLabel('Edit note')
    this.noteEditError = page.getByTestId('note-edit-error')

    // CV
    this.cvInput = page.getByLabel('Upload a CV')
    this.uploadCvButton = page.getByRole('button', { name: 'Upload CV' })
    this.cvError = page.getByTestId('cv-error')
    this.cvLink = page.getByTestId('cv-download-link')
    this.cvDetails = page.getByTestId('cv-meta')
    this.cvEmptyMessage = page.getByTestId('cv-empty')
    this.removeCvButton = page.getByRole('button', { name: 'Remove CV' })

    // Status
    // By role, because the confirmation dialog is also labelled "Change status"
    this.statusSelect = page.getByRole('combobox', { name: 'Change status' })
    this.updateStatusButton = page.getByRole('button', { name: 'Update status' })
    this.statusError = page.getByTestId('status-error')
    this.statusHistory = new Table(page.getByTestId('status-history-table'), 'status-history-row')

    // Jobs
    this.applications = new Table(page.getByTestId('applications-table'), 'application-row')
    this.assignJobSelect = page.getByLabel('Assign to an open job')
    this.assignJobButton = page.getByRole('button', { name: 'Assign', exact: true })
    this.assignJobError = page.getByTestId('assign-job-error')
  }

  async goto(id) {
    await this.page.goto(`/candidates/${id}`)
  }

  // A value in the Details panel, e.g. detail('email')
  detail(key) {
    return this.page.getByTestId(`detail-${key}`)
  }

  note(text) {
    return this.notes.filter({ hasText: text })
  }

  async addNote(text) {
    await this.noteInput.fill(text)
    await this.addNoteButton.click()
  }

  async startEditingNote(text) {
    await this.note(text).getByRole('button', { name: 'Edit' }).click()
  }

  async editNote(text, newText) {
    await this.startEditingNote(text)
    await this.noteEditInput.fill(newText)
    await this.page.getByRole('button', { name: 'Save', exact: true }).click()
  }

  // Opens the confirmation dialog; call confirmDialog.accept() or .cancel() next
  async requestNoteDeletion(text) {
    await this.note(text).getByRole('button', { name: 'Delete' }).click()
  }

  async deleteNote(text) {
    await this.requestNoteDeletion(text)
    await this.confirmDialog.accept()
  }

  // file is { name, mimeType, buffer }, e.g. from buildFile() in tests/data/files.js
  async uploadCv(file) {
    await this.cvInput.setInputFiles(file)
    await this.uploadCvButton.click()
  }

  async removeCv() {
    await this.removeCvButton.click()
    await this.confirmDialog.accept()
  }

  async changeStatus(status) {
    await this.statusSelect.selectOption(status)
    await this.updateStatusButton.click()
  }

  async assignToJob(jobLabel) {
    await this.assignJobSelect.selectOption({ label: jobLabel })
    await this.assignJobButton.click()
  }

  // Statuses in the history table, newest first
  statusHistoryStatuses() {
    return this.statusHistory.cellTexts('status-history-status')
  }

  async expectStatusHistory(statuses) {
    await expect(this.statusHistory.rows.getByTestId('status-history-status')).toHaveText(statuses)
  }
}

module.exports = { CandidateProfilePage }
