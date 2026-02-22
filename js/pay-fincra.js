/* global process */
const axios = require('axios')
require('dotenv').config()

const createCheckout = async (amount, redirectPath, email, name, ref) => {
  const options = {
    method: 'POST',
    url: `https://${process.env.FINCRA_ENDPOINT}/checkout/payments`,
    headers: {
      accept: 'application/json',
      'x-pub-key': process.env.FINCRA_PUBLIC_KEY,
      'x-business-id': process.env.BUSINESS_ID,
      'content-type': 'application/json',
      'api-key': process.env.FINCRA_PRIVATE_KEY,
    },
    data: {
      currency: 'NGN',
      customer: { name: 'Name is ' + name, email },
      paymentMethods: ['bank_transfer', 'card'],
      amount: Number(amount),
      redirectUrl: `${process.env.SELF_URL}${redirectPath}`,
      reference: ref,
      feeBearer: 'business', // 'customer',
      settlementDestination: 'wallet',
      defaultPaymentMethod: 'bank_transfer',
    },
  }

  try {
    const response = await axios.request(options)
    return { url: response?.data?.data?.link }
  } catch (error) {
    console.error('Error in Create Checkout', error?.message, error?.response?.data?.message)
    return { error: error?.message + ' ' + error?.response?.data?.message }
  }
}

const getBusinessId = async () => {
  try {
    const response = await axios.get(
      `https://${process.env.FINCRA_ENDPOINT}/profile/business/me`,
      {
        headers: {
          Accept: 'application/json',
          'api-key': process.env.FINCRA_PRIVATE_KEY,
        },
      }
    );

    console.log('Business: ', response.data.message);
    return response.data;
  } catch (error) {
    console.error('Error fetching business ID:', error.message);
    if (error.response) {
      console.error('Response Data:', error.response.data);
    }
    throw error;
  }
};
// getBusinessId().then(log)
// createCheckout('100', '/uptime?a=b&ref=two_tx__70', 'softmuneeb@gmail.com', 'M', 'two_tx__70').then(console.log)
// createCheckout('10000', '/uptime?a=b&ref=two_tx__130', 'softmuneeb@gmail.com', 'M', 'two_tx__131').then(console.log)

module.exports = { createCheckout, getBusinessId }
