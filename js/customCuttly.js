/* global process */
require('dotenv').config()
const axios = require('axios')
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY

const createCustomShortUrlCuttly = async (longUrl, name) => {
  try {
    const response = await axios.post(
      'https://url-shortener42.p.rapidapi.com/shorten/',
      {
        url: longUrl,
        validity_duration: 12,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': 'url-shortener42.p.rapidapi.com',
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
      },
    )

    const shortLink = response.data.url
    if (response.status === 200 || response.status === 201) {
      return shortLink
    } else {
      throw new Error(`RapidAPI returned status ${response.status}`)
    }
  } catch (error) {
    if (error.response) {
      throw new Error(`RapidAPI error (${error.response.status}): ${error.response.data?.message || JSON.stringify(error.response.data)}`)
    }
    throw error
  }
}

module.exports = createCustomShortUrlCuttly
