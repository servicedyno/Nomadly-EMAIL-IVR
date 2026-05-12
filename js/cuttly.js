/* global process */
require('dotenv').config()
const axios = require('axios')
const qs = require('querystring')
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY

// 2026-05-12 (3rd iteration): user-supplied correct provider for branded
// short URLs is `srtn-me-url-shortener.p.rapidapi.com` — returns links on
// `srtn.me/<slug>`. Endpoint: POST /api/shorten with form-urlencoded body
// (description, url). Response: { url: "https://srtn.me/<slug>" }.
//
// History:
//   - url-shortener42 (deprecated)
//   - url-shortener57 (returned goolnk.com — not the desired brand)
//   - tiny-url-shortner.p.rapidapi.com (returned tinyurl.com — brand leak)
//   - srtn-me-url-shortener.p.rapidapi.com (current — returns srtn.me)
//
// Provider can still be overridden at runtime via env vars if ops needs to
// swap without redeploying.
const PROVIDER_HOST = process.env.RAPIDAPI_SHORTENER_HOST || 'srtn-me-url-shortener.p.rapidapi.com'
const PROVIDER_PATH = process.env.RAPIDAPI_SHORTENER_PATH || '/api/shorten'
const PROVIDER_RESULT_FIELD = process.env.RAPIDAPI_SHORTENER_FIELD || 'url'
const PROVIDER_DESCRIPTION = process.env.RAPIDAPI_SHORTENER_DESCRIPTION || 'Shortit link'

const createShortUrlApi = async longUrl => {
  try {
    const response = await axios.post(
      `https://${PROVIDER_HOST}${PROVIDER_PATH}`,
      qs.stringify({ description: PROVIDER_DESCRIPTION, url: longUrl }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-rapidapi-host': PROVIDER_HOST,
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
      },
    )

    const shortLink = response.data?.[PROVIDER_RESULT_FIELD]
    if ((response.status === 200 || response.status === 201) && shortLink) {
      return shortLink
    }
    if (response.data?.error || response.data?.message) {
      throw new Error(`RapidAPI error: ${response.data.error || response.data.message}`)
    }
    throw new Error(`RapidAPI returned status ${response.status} without a ${PROVIDER_RESULT_FIELD}`)
  } catch (error) {
    if (error.response) {
      throw new Error(`RapidAPI error (${error.response.status}): ${error.response.data?.error || error.response.data?.message || JSON.stringify(error.response.data)}`)
    }
    throw error
  }
}

const analyticsCuttly = async shortUrlHash => {
  // srtn-me-url-shortener.p.rapidapi.com does not provide a stats endpoint.
  // For legacy ap1s.net links, return 0 since PromptAPI is no longer available.
  // New links use the clicksOn MongoDB collection for tracking instead.
  return 0
}

module.exports = { createShortUrlApi, analyticsCuttly }
