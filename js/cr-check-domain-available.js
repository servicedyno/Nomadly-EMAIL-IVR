/* global process */
require('dotenv').config()
const whm = require('./whm-service')
const { checkDomainPrice } = require('./domain-service')

const checkExistingDomain = async (websiteName) => {
  try {
    const { exists } = await whm.domainExists(websiteName)
    if (exists) {
      return {
        available: false,
        message: `The domain ${websiteName} already has a hosting account on this server.`,
      }
    }
    return {
      available: true,
      message: `Domain ${websiteName} is ready for hosting setup.`,
    }
  } catch (error) {
    return {
      available: false,
      message: `An error occurred while checking domain: ${error.message}`,
    }
  }
}

const getNewDomain = async (domainName) => {
  try {
    // First check if domain already exists on WHM server
    const { exists } = await whm.domainExists(domainName)
    if (exists) {
      return {
        available: false,
        originalPrice: 0,
        price: 0,
        chatMessage: `The domain ${domainName} already has a hosting account on this server.`,
        domainType: null,
      }
    }

    // Check domain registration pricing from registrars (CR + OP)
    const result = await checkDomainPrice(domainName)

    if (!result.available) {
      return {
        available: false,
        originalPrice: 0,
        price: 0,
        chatMessage: result.message || 'Domain name not available, please try another domain name',
        domainType: null,
      }
    }

    // Detect premium domains (price significantly higher than original cost)
    const domainType = (result.originalPrice && result.price > result.originalPrice * 3) ? 'Premium' : 'Standard'

    return {
      available: true,
      originalPrice: result.originalPrice,
      price: result.price,
      chatMessage: result.message || `Domain ${domainName} is available!`,
      domainType,
      registrar: result.registrar,
    }
  } catch (error) {
    console.error(`[getNewDomain] Error checking ${domainName}:`, error.message)
    return {
      available: false,
      originalPrice: 0,
      price: 0,
      chatMessage: `An error occurred while checking domain: ${error.message}`,
      domainType: null,
    }
  }
}

module.exports = { checkExistingDomain, getNewDomain }
