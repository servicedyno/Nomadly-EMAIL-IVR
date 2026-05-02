/* global process */
require('dotenv').config()
const axios = require('axios')
const qs = require('querystring')
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY

// Switched from url-shortener57.p.rapidapi.com (POST /shorten → result_url)
// to tiny-url-shortner.p.rapidapi.com (POST /index.php → shortened_url) on
// 2026-05-02 — the new provider is cheaper and more reliable on production.
const createShortUrlApi = async longUrl => {
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

const analyticsCuttly = async shortUrlHash => {
  // tiny-url-shortner.p.rapidapi.com does not provide a stats endpoint.
  // For legacy ap1s.net links, return 0 since PromptAPI is no longer available.
  // New links use the clicksOn MongoDB collection for tracking instead.
  return 0
}

module.exports = { createShortUrlApi, analyticsCuttly }
