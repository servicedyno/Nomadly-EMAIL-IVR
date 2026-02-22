/* global process */
require('dotenv').config()
const axios = require('axios')
const { log } = require('console')
const { updateDNSRecordNs } = require('./cr-dns-record-update-ns')

const API_KEY = process.env.API_KEY_CONNECT_RESELLER

const saveServerInDomain = async (domainName, server, RecordType = 'CNAME', domainNameId, nsId, dnsRecords, hostName, priority) => {
  console.log('#########saveServerInDomain', { domainName, server, RecordType, domainNameId, nsId, dnsRecords, hostName })
  if (RecordType === 'NS') return await updateDNSRecordNs(domainNameId, domainName, server, nsId, dnsRecords)

  log(`saveServerInDomain ${domainName} ${server} ${RecordType}`)
  let dnsZoneId
  let websiteId

  try {
    const url = `https://api.connectreseller.com/ConnectReseller/ESHOP/ViewDomain`
    const params = {
      APIKey: API_KEY,
      websiteName: domainName,
    }
    const response = await axios.get(url, { params })
    if (response?.data?.responseMsg?.statusCode === 200) {
      websiteId = response?.data?.responseData?.websiteId
    } else {
      let e = response?.data?.responseMsg?.message
      console.error('Error saveServerInDomain 1', e)
      return { error: e }
    }
  } catch (error) {
    let e = `${error?.message} ${JSON.stringify(error?.response?.data)}`
    console.error('Error saveServerInDomain 2', e)
    return { error: e }
  }

  try {
    const params = {
      APIKey: API_KEY,
      WebsiteId: websiteId,
    }
    const url = `https://api.connectreseller.com/ConnectReseller/ESHOP/ManageDNSRecords`
    const dnsMgmtRes = await axios.get(url, { params }) // Enable DNS Management
    console.log({ dnsMgmtRes: dnsMgmtRes?.data })
  } catch (error) {
    const e = `${error?.message} ${JSON.stringify(error?.response?.data)}`
    console.error('Error saveServerInDomain - ManageDNSRecords', e)
    return { error: e }
  }  

  try {
    const url = `https://api.connectreseller.com/ConnectReseller/ESHOP/ViewDomain`
    const params = {
      APIKey: API_KEY,
      websiteName: domainName,
    }
    const response = await axios.get(url, { params })
    if (response?.data?.responseMsg?.statusCode === 200) {
      dnsZoneId = response?.data?.responseData?.dnszoneId
    } else {
      let e = response?.data?.responseMsg?.message
      console.error('Error saveServerInDomain 3', e)
      return { error: e }
    }
  } catch (error) {
    let e = `${error?.message} ${JSON.stringify(error?.response?.data)}`
    console.error('Error saveServerInDomain 4', e)
    return { error: e }
  }

  const RECORD_NAME = hostName ? `${hostName}.${domainName}` : domainName
  const RECORD_VALUE = server
  const RECORD_TTL = 30

  try {
    const url = 'https://api.connectreseller.com/ConnectReseller/ESHOP/AddDNSRecord'
    const params = {
      APIKey: API_KEY,
      DNSZoneID: dnsZoneId,
      RecordName: RECORD_NAME,
      RecordType,
      RecordValue: RECORD_VALUE,
      RecordTTL: RECORD_TTL,
    }
    if (RecordType === 'MX' && priority !== undefined) params.RecordPriority = priority
    console.log(params)
    const response = await axios.get(url, { params })
    const success = 200 === response?.data?.responseData?.statusCode
    return success ? { success } : { error: response?.data?.responseData?.message }
  } catch (error) {
    console.error('Error saveServerInDomain 5', error?.message, error?.response?.data)
    return { error: `${error?.message} ${error?.response?.data}` }
  }
}

// saveServerInDomain('flower-season.sbs', 'abc.server.rail.app').then(console.log)

module.exports = { saveServerInDomain }
