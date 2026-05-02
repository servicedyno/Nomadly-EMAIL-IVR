/* global process */
require('dotenv').config()
const axios = require('axios')
const qs = require('querystring')
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY

// NOTE: tiny-url-shortner.p.rapidapi.com (like the legacy url-shortener57) does
// NOT support custom aliases — only the `url=` parameter is accepted. The
// caller-supplied `name` is kept in the signature for API stability but is
// ignored by the upstream. Custom-alias UX in the bot falls back to the
// clicksOn-collection internal resolver.
const createCustomShortUrlCuttly = async (longUrl, name) => {
  try {
    const response = await axios.post(
      'https://tiny-url-shortner.p.rapidapi.com/index.php',
      qs.stringify({ url: longUrl }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-rapidapi-host': 'tiny-url-shortner.p.rapidapi.com',
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
      },
    )

    const shortLink = response.data?.shortened_url
    if ((response.status === 200 || response.status === 201) && response.data?.success && shortLink) {
      return shortLink
    }
    if (response.data?.error || response.data?.message) {
      throw new Error(`RapidAPI error: ${response.data.error || response.data.message}`)
    }
    throw new Error(`RapidAPI returned status ${response.status} without a shortened_url`)
  } catch (error) {
    if (error.response) {
      throw new Error(`RapidAPI error (${error.response.status}): ${error.response.data?.error || error.response.data?.message || JSON.stringify(error.response.data)}`)
    }
    throw error
  }
}

module.exports = createCustomShortUrlCuttly
