/* global process */
require('dotenv').config()
const axios = require('axios')
const accessToken = process.env.API_BITLY
const bitlyApiUrl = 'https://api-ssl.bitly.com/v4/shorten'

const createShortBitly = async longUrl => {
  const response = await axios.post(
    bitlyApiUrl,
    {
      long_url: longUrl,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  )

  const shortUrl = response.data.id
  return shortUrl
}

module.exports = createShortBitly
