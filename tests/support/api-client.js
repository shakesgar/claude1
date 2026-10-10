const { expect } = require('@playwright/test')
const { buildCandidate, buildJob, buildNote } = require('../data/builders')

// Creates test data through the REST API so UI tests can start from a known state.
// Each method fails the test with the response body if the API does not accept the request.
class ApiClient {
  constructor(request) {
    this.request = request
  }

  async send(method, url, data, expectedStatus) {
    const response = await this.request[method](url, data === undefined ? undefined : { data })
    expect(response.status(), `${method.toUpperCase()} ${url}: ${await response.text()}`).toBe(expectedStatus)
    return expectedStatus === 204 ? null : response.json()
  }

  createCandidate(overrides = {}) {
    return this.send('post', '/api/candidates', buildCandidate(overrides), 201)
  }

  createDraft(overrides = {}) {
    return this.send('post', '/api/candidates', { ...overrides, status: 'Draft' }, 201)
  }

  getCandidate(id) {
    return this.send('get', `/api/candidates/${id}`, undefined, 200)
  }

  createJob(overrides = {}) {
    return this.send('post', '/api/jobs', buildJob(overrides), 201)
  }

  addNote(candidateId, overrides = {}) {
    return this.send('post', `/api/candidates/${candidateId}/notes`, buildNote(overrides), 201)
  }

  // Pairs a candidate with a job; the pairing starts at the Applied stage
  assign(candidateId, jobId) {
    return this.send('post', '/api/pipeline', { candidateId, jobId }, 201)
  }

  moveTo(applicationId, stage) {
    return this.send('patch', `/api/pipeline/${applicationId}`, { stage }, 200)
  }

  getApplication(applicationId) {
    return this.send('get', `/api/pipeline/${applicationId}`, undefined, 200)
  }
}

module.exports = { ApiClient }
