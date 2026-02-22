// Load configuration first
require('./config-setup');

// Global error handlers to prevent crashes
const { safeStringify } = require('./utils');
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', safeStringify(reason))
  console.error('Promise:', promise)
})

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message)
  console.error('Stack:', error.stack)
  // Don't exit the process to keep the bot running
})

const axios = require('axios');
const { log } = require('console');
const { convert } = require('./pay-blockbee');
const { getBusinessId } = require('./pay-fincra');
const { isRailwayAPIWorking } = require('./rl-save-domain-in-server');
const { autoWhitelistIP } = require('./whm-service');
// const { getRegisteredDomainNames } = require('./get-purchased-domains.test');

const getIPAndLogMessage = async () => {
  try {
    const response = await axios.get('https://api.ipify.org/');
    const ip = response.data;
    const message = `Please add \`\`\`${ip}\`\`\` to whitelist in Connect Reseller, API Section. https://global.connectreseller.com/tools/profile`;
    log(message);
  } catch (error) {
    handleAxiosError(error, 'Error fetching IP address');
  }
};

const logConversion = async (amount, fromCurrency, toCurrency, description) => {
  try {
    const result = await convert(amount, fromCurrency, toCurrency);
    log(`Working, ${description}:`, result);
  } catch (error) {
    handleAxiosError(error, `Error converting ${fromCurrency} to ${toCurrency}`);
  }
};

const handleAxiosError = (error, customMessage) => {
  log(customMessage);
  log(
    'Detailed Error:',
    error?.message,
    error?.response?.data,
    error?.cause,
    safeStringify(error?.response?.data)
  );
};

const runBot = async () => {
  try {
    // Auto-whitelist this server's IP on the WHM server
    await autoWhitelistIP();

    // Fetch and log the IP to whitelist in Connect Reseller
    // await getIPAndLogMessage();

    // Uncomment if needed in the future
    // await getBusinessId();
    log('Working, Fincra API');

    // Uncomment if needed in the future
    // await getRegisteredDomainNames();
    // log('Working, Connect Reseller API');

    // Fetch and log BTC to USD conversion
    // await logConversion('1', 'btc', 'usd', 'Blockbee API, BTC price in USD');

    // Fetch and log MATIC to USD conversion
    // await logConversion('1', 'polygon_matic', 'usd', 'Matic price in USD');

    // Check if Railway API is working
    // await isRailwayAPIWorking();
    log('Working, Railway API, now starting the bot');

    // Start the bot
    require('./_index.js');

  } catch (error) {
    log('Error is:', error);
  }
};

// Run the bot
runBot();
