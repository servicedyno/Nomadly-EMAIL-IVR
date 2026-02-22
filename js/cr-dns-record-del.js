/* global process */
require('dotenv').config()
const axios = require('axios')
const { log } = require('console')
const APIKey = process.env.API_KEY_CONNECT_RESELLER
const { updateDNSRecordNs } = require('./cr-dns-record-update-ns')

const deleteDNSRecord = async (DNSZoneID, DNSZoneRecordID, domain, domainNameId, nsId, dnsRecords) => {
  if (nsId) return updateDNSRecordNs(domainNameId, domain, undefined, nsId, dnsRecords)
  try {
    const apiUrl = 'https://api.connectreseller.com/ConnectReseller/ESHOP/DeleteDNSRecord'
    const requestData = {
      APIKey,
      DNSZoneID,
      DNSZoneRecordID,
    }

    const response = await axios.get(apiUrl, { params: requestData })
    log('deleteDNSRecord ', { DNSZoneID, DNSZoneRecordID }, JSON.stringify(response.data, null, 2))

    if (response?.data?.responseMsg?.statusCode === 200) {
      return { success: true }
    } else {
      let errorMessage = `Issue in deleteDNSRecord ${response?.data?.responseMsg?.message}`
      log(errorMessage)
      return { error: errorMessage }
    }
  } catch (error) {
    const errorMessage = `Error deleteDNSRecord ${error.message} ${JSON.stringify(error?.response?.data, null, 2)}`
    log(error, errorMessage)
    return { error: errorMessage }
  }
}
// const dnszoneID = 153141;
// const dnszoneRecordID = 1112776268;
// deleteDNSRecord(dnszoneID, dnszoneRecordID);

module.exports = { deleteDNSRecord }
