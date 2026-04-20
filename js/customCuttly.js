/* global process */
require('dotenv').config()
const axios = require('axios')
const qs = require('querystring')
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY

const createCustomShortUrlCuttly = async (longUrl, name) => {
  try {
    const response = await axios.post(
      'https://url-shortener57.p.rapidapi.com/shorten',
      qs.stringify({ url: longUrl }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-rapidapi-host': 'url-shortener57.p.rapidapi.com',
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
      },
    )

    const shortLink = response.data?.result_url
    if ((response.status === 200 || response.status === 201) && shortLink) {
      return shortLink
    }
    if (response.data?.error) {
      throw new Error(`RapidAPI error: ${response.data.error}`)
    }
    throw new Error(`RapidAPI returned status ${response.status} without a result_url`)
  } catch (error) {
    if (error.response) {
      throw new Error(`RapidAPI error (${error.response.status}): ${error.response.data?.error || error.response.data?.message || JSON.stringify(error.response.data)}`)
    }
    throw error
  }
}

module.exports = createCustomShortUrlCuttly
