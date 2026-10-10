// `node server.js --test` is a cross-platform alternative to setting NODE_ENV=test
if (process.argv.includes('--test')) process.env.NODE_ENV = 'test'

const { createApp } = require('./src/app')

const port = Number(process.env.PORT) || 3000
const testMode = process.env.NODE_ENV === 'test'

createApp().listen(port, () => {
  console.log(`Recruit Demo CRM running at http://localhost:${port}`)
  if (testMode) console.log('Test mode: POST /api/test/reset is enabled')
})
