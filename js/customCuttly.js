/* global process */
require('dotenv').config()
const axios = require('axios')
const qs = require('querystring')
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY

// NOTE: srtn-me-url-shortener.p.rapidapi.com returns a random 6-char slug and
// does NOT support custom aliases on the BASIC tier (verified 2026-02 — all
// alias-parameter variants were silently ignored). The caller-supplied `name`
// is kept in the signature for API stability but is ignored by the upstream.
// Custom-alias UX in the bot falls back to the clicksOn-collection internal
// resolver.
const createCustomShortUrlCuttly = async (longUrl, name) => {
  try {
    const response = await axios.post(
      'https://srtn-me-url-shortener.p.rapidapi.com/api/shorten',
      qs.stringify({ url: longUrl, description: name || '' }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-rapidapi-host': 'srtn-me-url-shortener.p.rapidapi.com',
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
      },
    )

    const shortLink = response.data?.url
    if ((response.status === 200 || response.status === 201) && typeof shortLink === 'string' && shortLink.startsWith('http')) {
      return shortLink
    }
    if (response.data?.error || response.data?.message) {
      throw new Error(`RapidAPI error: ${response.data.error || response.data.message}`)
    }
    throw new Error(`RapidAPI returned status ${response.status} without a short url`)
  } catch (error) {
    if (error.response) {
      throw new Error(`RapidAPI error (${error.response.status}): ${error.response.data?.error || error.response.data?.message || JSON.stringify(error.response.data)}`)
    }
    throw error
  }
}

module.exports = createCustomShortUrlCuttly
