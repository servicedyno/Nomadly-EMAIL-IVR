require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const TOKEN = process.env.API_KEY_RAILWAY
const GQL_URL = 'https://backboard.railway.com/graphql/v2'

// Project tokens are sent as 'Project-Access-Token' header, NOT Authorization Bearer
// Try multiple auth styles
async function tryAuth(headers, label, query) {
  console.log(`\n--- ${label} ---`)
  try {
    const r = await axios.post(GQL_URL, { query }, { headers, timeout: 20000 })
    if (r.data?.errors) {
      console.log('  errors:', JSON.stringify(r.data.errors).substring(0, 300))
      return null
    }
    console.log('  ✓', JSON.stringify(r.data?.data).substring(0, 400))
    return r.data?.data
  } catch (e) {
    console.log('  ✗', e.response?.status, JSON.stringify(e.response?.data || e.message).substring(0, 300))
    return null
  }
}

;(async () => {
  // Test query that works on project token
  const projectScopedQuery = `{ projectToken { projectId environmentId } }`
  const accountQuery = `{ me { id email } }`

  await tryAuth({ Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, 'Bearer (account)', accountQuery)
  await tryAuth({ 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }, 'Project-Access-Token', projectScopedQuery)
  await tryAuth({ Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, 'Bearer projectToken query', projectScopedQuery)
})().catch(e=>console.error(e))
