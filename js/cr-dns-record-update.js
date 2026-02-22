/* global process */
require('dotenv').config()
const axios = require('axios')
const { log } = require('console')
const APIKey = process.env.API_KEY_CONNECT_RESELLER
const { updateDNSRecordNs } = require('./cr-dns-record-update-ns')
const { saveServerInDomain } = require('./cr-dns-record-add')

const updateDNSRecord = async (
  DNSZoneID,
  DNSZoneRecordID,
  domainName,
  RecordType,
  RecordValue,
  domainNameId,
  nsId,
  dnsRecords,
  hostName
) => {
  if (RecordType === 'NS') return await updateDNSRecordNs(domainNameId, domainName, RecordValue, nsId, dnsRecords)

  // Custom Requirement fulfilled, if no A record present then show A Record: None, so we are updating it by creating it
  if (RecordType === 'A' && !DNSZoneID) return await saveServerInDomain(domainName, RecordValue, 'A', null, null, null, hostName)

  try {
    const apiUrl = 'https://api.connectreseller.com/ConnectReseller/ESHOP/ModifyDNSRecord'
    const RecordName = hostName ? `${hostName}.${domainName}` : domainName
    const requestData = {
      APIKey,
      DNSZoneID,
      RecordName,
      RecordType,
      RecordValue,
      DNSZoneRecordID,
    }

    const response = await axios.get(apiUrl, { params: requestData })
    log(
      'update DNS Record ',
      { DNSZoneID, DNSZoneRecordID, RecordName, RecordType, RecordValue },
      JSON.stringify(response.data, null, 2),
    )

    if (response?.data?.responseMsg?.statusCode === 200) {
      return { success: true }
    } else {
      let errorMessage = `Issue in update DNS Record ${response?.data?.responseMsg?.message}`
      log(errorMessage)
      return { error: errorMessage }
    }
  } catch (error) {
    const errorMessage = `Error update DNS Record ${error.message} ${JSON.stringify(error?.response?.data, null, 2)}`
    log(error, errorMessage)
    return { error: errorMessage }
  }
}
// const dnszoneID = 153141;
// const dnszoneRecordID = 1112779751;
// updateDNSRecord(dnszoneID, dnszoneRecordID, 'glasso.sbs', 'CNAME', 'abc.def').then(log);

module.exports = { updateDNSRecord }
