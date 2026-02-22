// const validatePhoneAws = require('./validatePhoneAws')
const validatePhoneNpl = require('./validatePhoneNpl')
// const validatePhoneNeutrino = require('./validatePhoneNeutrino')
// const { customAlphabet } = require('nanoid')
const { log } = require('console')
// const validatePhoneTwilioV1 = require('./validatePhoneTwilioV1')
const { date } = require('./utils')
const validatePhoneAlcazar = require('./validatePhoneAlcazar')
// const part1 = customAlphabet('23456789', 1)
// const part2 = customAlphabet('0123456789', 6)

const validatePhone = async phone => {
  // const countryCode = '+1'
  // const areaCode = '862' // hit rate is very good, maintain hit rate, maintain duplicate generation, avoid api calls for duplicates, maintain duplicate gen rate

  // const phone = countryCode + areaCode + part1() + part2()

  // const neu = await validatePhoneNeutrino(phone)
  const npl = await validatePhoneNpl(phone)
  const alc = await validatePhoneAlcazar(phone)
  // const aws = await validatePhoneAws(phone)
  // const twi = await validatePhoneTwilioV1(phone)

  log(`${date()}, ${phone}, ${npl}, ${alc}`)
}

const validatePhones = async () => {
  const phones = [
    // '14152401761',
    // '14154700185',
    // '14155325316',
    // '13109902195',
    // '12126580363',
    // '14154219418',
    // '18624520081',
    // '14154131508',
    // '13057862886',
    // '18622039173',
    '18622919288',
  ]
  // log(`date, phone, npl, alcazar`)
  for (let i = 0; i < phones.length; i++) {
    await validatePhone(phones[i])
  }
}

validatePhones()