
const calls = []
module.exports = {
  __calls: calls,
  getZoneByName: async () => null,
  createZone: async (domain) => {
    calls.push(['createZone', domain])
    return { success: true, zoneId: 'zone-' + domain, nameservers: ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com'], status: 'pending' }
  },
  cleanupConflictingDNS: async () => { calls.push(['cleanupConflictingDNS']) },
  createHostingDNSRecords: async () => { calls.push(['createHostingDNSRecords']) },
  setSSLMode: async () => { calls.push(['setSSLMode']) },
  enforceHTTPS: async () => { calls.push(['enforceHTTPS']) },
  enableAuthenticatedOriginPulls: async () => { calls.push(['AOP']) },
  generateOriginCACert: async () => ({ success: false, error: 'mock-skip' }),
}
