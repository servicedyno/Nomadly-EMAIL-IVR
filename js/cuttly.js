/* global process */
require('dotenv').config()
const axios = require('axios')
const qs = require('querystring')
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY

// 2026-05-12: Reverted from tiny-url-shortner.p.rapidapi.com (returned
//   tinyurl.com hashes — leaked a foreign brand to every user) back to
//   url-shortener57.p.rapidapi.com which returns a Shortit-compatible
//   short link on its own white-label domain. The 2026-05-02 swap was
//   reverted after the production complaint from @Dprincecharles.
// Provider can be overridden at runtime via RAPIDAPI_SHORTENER_HOST + the
// matching endpoint path / response field if ops needs to swap providers
// without redeploying code.
const PROVIDER_HOST = process.env.RAPIDAPI_SHORTENER_HOST || 'url-shortener57.p.rapidapi.com'
const PROVIDER_PATH = process.env.RAPIDAPI_SHORTENER_PATH || '/shorten'
const PROVIDER_RESULT_FIELD = process.env.RAPIDAPI_SHORTENER_FIELD || 'result_url'

const createShortUrlApi = async longUrl => {
  try {
    const response = await axios.post(
      `https://${PROVIDER_HOST}${PROVIDER_PATH}`,
      qs.stringify({ url: longUrl }),
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
  // url-shortener57.p.rapidapi.com does not provide a stats endpoint.
  // For legacy ap1s.net links, return 0 since PromptAPI is no longer available.
  // New links use the clicksOn MongoDB collection for tracking instead.
  return 0
}

module.exports = { createShortUrlApi, analyticsCuttly }
