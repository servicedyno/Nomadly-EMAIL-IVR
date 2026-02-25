/*global process */
require('dotenv').config()
const axios = require('axios')
const { log } = require('console')
const API_TOKEN = process.env.API_KEY_RAILWAY

const RENDER_AUTH_TOKEN = process.env.RENDER_AUTH_TOKEN
const DOMAINS_CONNECT_TO_RENDER_SERVICE_ID = process.env.DOMAINS_CONNECT_TO_RENDER_SERVICE_ID
const RENDER_APP_IP_ADDRESS = process.env.RENDER_APP_IP_ADDRESS
const ENVIRONMENT_ID = process.env.RAILWAY_ENVIRONMENT_ID
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID
const SERVICE_ID = process.env.RAILWAY_SERVICE_ID
const GRAPHQL_ENDPOINT = 'https://backboard.railway.app/graphql/v2'

/**
 * Query Railway for an existing custom domain's CNAME target.
 * Returns { server, recordType } if found, or null.
 */
async function getExistingRailwayCNAME(domain) {
  try {
    const query = `query {
      domains(projectId: "${PROJECT_ID}", serviceId: "${SERVICE_ID}", environmentId: "${ENVIRONMENT_ID}") {
        customDomains {
          domain
          status {
            dnsRecords {
              requiredValue
              recordType
            }
          }
        }
      }
    }`
    const res = await axios.post(GRAPHQL_ENDPOINT, { query }, {
      headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    })
    const customDomains = res.data?.data?.domains?.customDomains || []
    const match = customDomains.find(d => d.domain === domain)
    if (match) {
      const cname = match.status?.dnsRecords?.[0]?.requiredValue
      if (cname) return { server: cname, recordType: 'CNAME' }
    }
    return null
  } catch (err) {
    log(`[Railway] getExistingRailwayCNAME error for ${domain}: ${err.message}`)
    return null
  }
}

const saveDomainInServerRender = async domain => {
  const url = `https://api.render.com/v1/services/${DOMAINS_CONNECT_TO_RENDER_SERVICE_ID}/custom-domains`
  const payload = { name: domain }
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    authorization: `Bearer ${RENDER_AUTH_TOKEN}`,
  }

  try {
    await axios.post(url, payload, { headers })
    return { server: RENDER_APP_IP_ADDRESS, recordType: 'A' }
  } catch (err) {
    const error = err?.message + ' ' + JSON.stringify(err?.response?.data, 0, 2)
    log('err saveDomainInServerRender', { url, payload, headers }, error)
    return { error }
  }
}
async function saveDomainInServerRailway(domain) {
  const GRAPHQL_QUERY = `
  mutation customDomainCreate {
      customDomainCreate(
          input: { domain: "${domain}", environmentId: "${ENVIRONMENT_ID}", projectId: "${PROJECT_ID}", serviceId: "${SERVICE_ID}"}
      ) {
          id
          status {
            dnsRecords {
              requiredValue
            }
          }
      }
  }`
  const response = await axios.post(
    GRAPHQL_ENDPOINT,
    { query: GRAPHQL_QUERY },
    {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    },
  )
  const error = response?.data?.errors?.[0]?.message

  if (error) {
    // Domain already exists on Railway — remove and re-create for clean state
    const isAlreadyExists = error.toLowerCase().includes('already') ||
      error.toLowerCase().includes('exists') ||
      error.toLowerCase().includes('duplicate') ||
      error.toLowerCase().includes('failed to create custom domain')
    if (isAlreadyExists) {
      log(`[Railway] Domain ${domain} already exists — querying existing CNAME target`)
      // ── Try to get the existing CNAME target first (domain is already on Railway = success) ──
      const existing = await getExistingRailwayCNAME(domain)
      if (existing) {
        log(`[Railway] Domain ${domain} already on Railway → ${existing.server} (reusing)`)
        return existing
      }
      // ── Couldn't fetch CNAME — try remove + re-create as fallback ──
      log(`[Railway] Could not fetch CNAME for ${domain} — attempting remove + re-create`)
      const removeResult = await removeDomainFromRailway(domain)
      if (removeResult.error) {
        log(`[Railway] Remove failed for ${domain}: ${removeResult.error}`)
        return { error: `Domain exists on Railway but could not be removed: ${removeResult.error}` }
      }
      // Wait briefly for Railway to process the deletion
      await new Promise(r => setTimeout(r, 3000))
      // Re-create
      const retryResponse = await axios.post(
        GRAPHQL_ENDPOINT,
        { query: GRAPHQL_QUERY },
        {
          headers: {
            Authorization: `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      )
      const retryError = retryResponse?.data?.errors?.[0]?.message
      if (retryError) {
        log(`[Railway] Re-create failed for ${domain}: ${retryError}`)
        return { error: retryError }
      }
      const server = retryResponse?.data?.data?.customDomainCreate?.status?.dnsRecords[0]?.requiredValue
      log(`[Railway] Re-created ${domain} → ${server}`)
      return { server, recordType: 'CNAME' }
    }
    log('Error saveDomainInServerRailway', error)
    log('domain', domain, 'GraphQL Response:', JSON.stringify(response.data, null, 2))
    return { error }
  }

  const server = response?.data?.data?.customDomainCreate?.status?.dnsRecords[0]?.requiredValue

  return { server, recordType: 'CNAME' }
}
async function isRailwayAPIWorking() {
  const GRAPHQL_QUERY = `
  query me {
  me {
    projects {
      edges {
        node {
          id
          name
        }
      }
    }
  }
}`
  const response = await axios.post(
    GRAPHQL_ENDPOINT,
    { query: GRAPHQL_QUERY },
    {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    },
  )
  const error = response?.data?.errors?.[0]?.message

  log('isRailwayAPIWorking')

  if (error) {
    log('Error query me', error)
    return { error }
  }

  return response.data
}

// isRailwayAPIWorking();
// saveDomainInServerRailway('blockbee.com').then(log);
// saveDomainInServerRender('ehtesham.sbs').then(log);

async function removeDomainFromRailway(domain) {
  const GRAPHQL_QUERY = `
  mutation customDomainDelete {
      customDomainDelete(
          input: { domain: "${domain}", environmentId: "${ENVIRONMENT_ID}", projectId: "${PROJECT_ID}", serviceId: "${SERVICE_ID}"}
      ) {
          id
      }
  }`
  try {
    const response = await axios.post(
      GRAPHQL_ENDPOINT,
      { query: GRAPHQL_QUERY },
      {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    )
    const error = response?.data?.errors?.[0]?.message
    if (error) {
      log('Error removeDomainFromRailway', error)
      return { error }
    }
    return { success: true }
  } catch (err) {
    log('Error removeDomainFromRailway', err.message)
    return { error: err.message }
  }
}

module.exports = { saveDomainInServerRailway, isRailwayAPIWorking, saveDomainInServerRender, removeDomainFromRailway }
