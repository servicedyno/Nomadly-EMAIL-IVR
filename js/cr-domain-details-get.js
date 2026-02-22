/* global process */
require('dotenv').config()
const axios = require('axios')

const getDomainDetails = async websiteName => {
  try {
    const API_KEY = process.env.API_KEY_CONNECT_RESELLER
    const URL = 'https://api.connectreseller.com/ConnectReseller/ESHOP/ViewDomain'

    const params = {
      APIKey: API_KEY,
      websiteName: websiteName,
    }

    const response = await axios.get(URL, { params })

    if (response?.status === 200) {
      const domainDetails = response.data
      // console.log('Domain Details:', domainDetails);
      return domainDetails
    } else {
      console.error('Failed to fetch domain details')
      return null
    }
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

// const websiteName = 'glasso.sbs';
// getDomainDetails(websiteName).then(log);
module.exports = getDomainDetails
