
const calls = []
module.exports = {
  __calls: calls,
  updateNameservers: async (domain, ns) => {
    calls.push({ domain, ns })
    return { success: true, propagation: { verified: true, matched: ns.length, elapsedMs: 1000, attempts: 1 } }
  },
}
