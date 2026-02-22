/* global process */
require('dotenv').config()
const axios = require('axios')
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY

const createCustomShortUrlCuttly = async (longUrl, name) => {
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
    console.error('createCustomShortUrlCuttly Error creating short URL, Code:', response?.status)
  }
}

module.exports = createCustomShortUrlCuttly
