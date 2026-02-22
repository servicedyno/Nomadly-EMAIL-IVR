/* global process */
const axios = require('axios')
require('dotenv').config()

const API_KEY = process.env.API_KEY_CONNECT_RESELLER
const apiUrl = `https://api.connectreseller.com/ConnectReseller/ESHOP/SearchDomainList?APIKey=${API_KEY}&page=1&maxIndex=100`

async function getRegisteredDomainNames() {
  const response = await axios.get(apiUrl)
  const domainRecords = response?.data?.records
  const domainNames = domainRecords.map(record => record.domainName)
  return domainNames
}
// getRegisteredDomainNames().then(console.log);
module.exports = { getRegisteredDomainNames }
