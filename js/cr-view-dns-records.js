/* global process */
require('dotenv').config()
const axios = require('axios')
const getDomainDetails = require('./cr-domain-details-get')
const { log } = require('console')

const API_KEY = process.env.API_KEY_CONNECT_RESELLER
const URL = 'https://api.connectreseller.com/ConnectReseller/ESHOP/ViewDNSRecord'

async function getDNSRecords(websiteId) {
  try {
    const params = {
      APIKey: API_KEY,
      WebsiteId: websiteId,
    }
    const response = await axios.get(URL, { params, timeout: 10000 })

    if (response.status === 200) {
      return response?.data?.responseData
    } else {
      log(`Error fetching DNS records. Status Code: ${response.status}`)
    }
  } catch (error) {
    log(`Error: ${error.message}`)
  }
}

// const viewDNSRecords = async domain => {
//   const details = await getDomainDetails(domain)

//   const { websiteId, domainNameId, nameserver1, nameserver2, nameserver3, nameserver4 } = details?.responseData
//   if (!websiteId || !domainNameId) {
//     log('No websiteId,', details?.responseMsg?.message)
//     return
//   }

//   const res = await getDNSRecords(websiteId)
//   let records = []

//   const a_records = res.filter(r => r.recordType === 'A')
//   records = a_records.length === 0 ? [{ recordContent: null, recordType: 'A' }] : a_records

//   nameserver1 && records.push({ domainNameId, recordContent: nameserver1, recordType: 'NS', nsId: 1 })
//   nameserver2 && records.push({ domainNameId, recordContent: nameserver2, recordType: 'NS', nsId: 2 })
//   nameserver3 && records.push({ domainNameId, recordContent: nameserver3, recordType: 'NS', nsId: 3 })
//   nameserver4 && records.push({ domainNameId, recordContent: nameserver4, recordType: 'NS', nsId: 4 })

//   records = [...records, ...res.filter(r => r.recordType === 'CNAME')]

//   return { records, domainNameId }
// }

const viewDNSRecords = async domain => {
  try {
    const details = await getDomainDetails(domain);

    const { websiteId, domainNameId, nameserver1, nameserver2, nameserver3, nameserver4 } = details?.responseData || {};
    if (!websiteId || !domainNameId) {
      log('No websiteId,', details?.responseMsg?.message)
      return { records: [], domainNameId: null, error: true }
    }

    const res = await getDNSRecords(websiteId);
    let records = [];

    const allRecords = Array.isArray(res) ? res : [];
    const a_records = allRecords.filter(r => r?.recordType === 'A');
    records = a_records.length === 0 ? [{ recordContent: null, recordType: 'A' }] : a_records;

    nameserver1 && records.push({ domainNameId, recordContent: nameserver1, recordType: 'NS', nsId: 1 });
    nameserver2 && records.push({ domainNameId, recordContent: nameserver2, recordType: 'NS', nsId: 2 });
    nameserver3 && records.push({ domainNameId, recordContent: nameserver3, recordType: 'NS', nsId: 3 });
    nameserver4 && records.push({ domainNameId, recordContent: nameserver4, recordType: 'NS', nsId: 4 });

    // Include ALL record types (CNAME, MX, TXT, AAAA, SRV, CAA)
    const otherTypes = ['CNAME', 'MX', 'TXT', 'AAAA', 'SRV', 'CAA'];
    for (const type of otherTypes) {
      records = [...records, ...allRecords.filter(r => r?.recordType === type)];
    }

    return { records, domainNameId };
  } catch (error) {
    console.error('❌ Error in viewDNSRecords:', error.message || error);
    return { records: [], domainNameId: null, error: true };
  }
};


// viewDNSRecords('glasso.sbs').then(log);

module.exports = viewDNSRecords
