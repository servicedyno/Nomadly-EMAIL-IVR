
module.exports = {
  getAddonLimit: () => -1,
  installDomainSSL: async () => ({ success: false }),
  excludeDomainsFromAutoSSL: async () => ({ success: true }),
}
