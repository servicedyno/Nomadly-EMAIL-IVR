/* global process */
require('dotenv').config()
const axios = require('axios')
const { log } = require('console')
const { alcazar } = require('./config')

const API_ALCAZAR = process.env.API_ALCAZAR
const apiUrl = 'http://api.east.alcazarnetworks.com/api/2.2/lrn'

const validatePhoneAlcazar = async (carrier, phone) => {
  const url = `${apiUrl}?tn=${phone}&extended=true&output=json&&key=${API_ALCAZAR}`

  const d1 = new Date()
  const res = await axios.get(url)
  const d2 = new Date()

  // console.log(res.data)
  const lec = res?.data?.LEC
  const isMobile = res?.data?.LINETYPE === 'WIRELESS'

  const filter = carrier === 'Mixed Carriers' ? true : alcazar[carrier].some(c => lec?.includes(c))
  isMobile && log('Alcazar', phone, lec)

  const result = isMobile && filter ? [`+${phone}`, lec, `Sec: ${(d2 - d1) / 1000}`] : null
  return result
}

// validatePhoneAlcazar('Mixed Carriers','18622039173') // US / Canada
// validatePhoneAlcazar('61385479556') // does not work for Australia, New Zealand, UK

module.exports = validatePhoneAlcazar
