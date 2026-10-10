// In-memory files for upload tests, in the shape Playwright's setInputFiles and multipart options accept
const MB = 1024 * 1024
const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  png: 'image/png'
}

function buildFile(name, sizeInBytes = 2048) {
  const extension = name.split('.').pop().toLowerCase()
  return {
    name,
    mimeType: MIME[extension] || 'application/octet-stream',
    buffer: Buffer.alloc(sizeInBytes, 'a')
  }
}

module.exports = { buildFile, MB }
