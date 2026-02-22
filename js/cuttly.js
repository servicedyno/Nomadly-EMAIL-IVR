/* global process */
require('dotenv').config()
const axios = require('axios')
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY

const createShortUrlApi = async longUrl => {
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
    console.error('Error creating short URL, Code: ', response?.status)
  }
}

const analyticsCuttly = async shortUrlHash => {
  // RapidAPI url-shortener42 does not provide a stats endpoint.
  // For legacy ap1s.net links, return 0 since PromptAPI is no longer available.
  // New links use the clicksOn MongoDB collection for tracking instead.
  return 0
}

module.exports = { createShortUrlApi, analyticsCuttly }
