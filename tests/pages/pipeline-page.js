const { expect } = require('@playwright/test')
const { Toast } = require('../components/toast')
const { ConfirmDialog } = require('../components/confirm-dialog')

const stageId = stage => stage.toLowerCase()

class PipelinePage {
  constructor(page) {
    this.page = page
    this.toast = new Toast(page)
    this.confirmDialog = new ConfirmDialog(page)
    this.board = page.getByTestId('pipeline-board')
    this.jobFilter = page.getByLabel('Job', { exact: true })
    this.resultCount = page.getByTestId('pipeline-result-count')
    this.cards = page.getByTestId('pipeline-card')
  }

  // Pass a job id to open the board filtered to that job
  async goto(jobId) {
    await this.page.goto(jobId ? `/pipeline?jobId=${jobId}` : '/pipeline')
    await this.waitUntilLoaded()
  }

  async waitUntilLoaded() {
    await expect(this.board).toHaveAttribute('aria-busy', 'false')
  }

  async filterByJob(jobLabel) {
    await this.jobFilter.selectOption({ label: jobLabel })
    await this.waitUntilLoaded()
  }

  column(stage) {
    return this.page.getByTestId(`pipeline-column-${stageId(stage)}`)
  }

  columnCount(stage) {
    return this.page.getByTestId(`pipeline-count-${stageId(stage)}`)
  }

  card(candidateName) {
    return this.cards.filter({ hasText: candidateName })
  }

  cardInColumn(stage, candidateName) {
    return this.column(stage).getByTestId('pipeline-card').filter({ hasText: candidateName })
  }

  stageSelect(candidateName) {
    return this.card(candidateName).getByLabel(`Move ${candidateName} to stage`)
  }

  moveButton(candidateName) {
    return this.card(candidateName).getByRole('button', { name: `Move ${candidateName}`, exact: true })
  }

  removeButton(candidateName) {
    return this.card(candidateName).getByRole('button', { name: /^Remove / })
  }

  // Picks a stage and clicks Move, which opens the confirmation dialog
  async requestMove(candidateName, stage) {
    await this.stageSelect(candidateName).selectOption(stage)
    await this.moveButton(candidateName).click()
  }

  async moveTo(candidateName, stage) {
    await this.requestMove(candidateName, stage)
    await this.confirmDialog.accept()
    await expect(this.cardInColumn(stage, candidateName)).toBeVisible()
  }
}

module.exports = { PipelinePage }
