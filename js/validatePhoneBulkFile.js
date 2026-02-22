/*global process */
const { t } = require('./config')
const { log } = require('console')
const { sleep } = require('./utils')
const validatePhoneAlcazar = require('./validatePhoneAlcazar')
const validatePhoneSignalwire = require('./validatePhoneSignalwire')
const validatePhoneNpl = require('./validatePhoneNpl')
const validatePhoneNeutrino = require('./validatePhoneNeutrino')
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID

// config
const parallelApiCalls = 5
const waitAfterParallelApiCalls = 1 * 1000 // 1 second

const showProgressEveryXTime = 120 // 60 iterations = 1 minute
const phoneGenTimeout = 10 * 60 * 60 * 1000 // 2 hour // 1 hr = 2000 hits almost
const phoneGenStopAtNoXHits = 250 // 250 Hits with 0 phone number found then break the loop

// core
const duplicate = {}
const areaCodeCount = {}
let first = 0

const validateNumberFile = async (phone, carrier, countryCode, cnam) => {
  const validatePhone = countryCode === '1' ? validatePhoneAlcazar : validatePhoneNpl

  if (first < parallelApiCalls) {
    log('Phone', phone)
    first++
  }

  if (duplicate[phone]) return log(`Duplicate ${phone}`)
  duplicate[phone] = true

  // neutrino for countries not US
  if (countryCode !== '1') {
    const res0 = await validatePhoneNeutrino(phone)
    if (!res0) return res0
  }

  const res1 = await validatePhone(carrier, phone)

  const areaCode = phone.slice(countryCode.length, countryCode.length + areaCodeLength[countryCode])
  const fullAc = '+' + countryCode + areaCode + ' ' + carrier
  const a = areaCodeCount[fullAc]
  const totalHits = (a?.totalHits || 0) + 1
  const goodHits = (a?.goodHits || 0) + (res1 ? 1 : 0)
  const percentage = Number((goodHits / totalHits) * 100).toFixed() + '% Good Hits'
  areaCodeCount[fullAc] = { totalHits, goodHits, percentage }

  if (!res1) return res1

  if (!cnam) {
    return [...res1]
  }

  return [...res1, await validatePhoneSignalwire(phone)]
}

const areaCodeLength = {
  1: 3,
  44: 2,
  64: 2,
  61: 1,
}

const validatePhoneBulkFile = async (carrier, phones, countryCode, cnam, bot, chatId) => {
  log({ phones: phones.length, countryCode, cnam }, '\n')

  let i = 0
  const res = []
  let elapsedTime = 0
  let noHitCount = 0
  const startTime = new Date()

  let promiseArr = [sleep(waitAfterParallelApiCalls)]

  for (i = 0; i < phones.length; i++) {
    promiseArr.push(validateNumberFile(phones[i], carrier, countryCode, cnam))

    if ((i !== 0 && i % parallelApiCalls === 0) || i === phones.length - 1) {
      const r = (await Promise.all(promiseArr)).filter(r => r)
      r[0] && res.push(...r)
      promiseArr = [sleep(waitAfterParallelApiCalls)]
    }

    // Publish Progress
    if (i === phones.length - 1) {
      const progress = t.validatorProgressFull(i, phones.length)
      bot && bot.sendMessage(chatId, progress)
    } else if (i % showProgressEveryXTime === 0) {
      const progress = t.validatorProgress(i, phones.length)
      bot && bot.sendMessage(chatId, progress)
      log(progress)
    }

    // Timeout Checks
    elapsedTime = new Date() - startTime
    if (elapsedTime > phoneGenTimeout) {
      bot && bot.sendMessage(chatId, t.phoneGenTimeout)
      bot &&
        bot.sendMessage(
          TELEGRAM_ADMIN_CHAT_ID,
          `${t.phoneGenTimeout} ElapsedTime ${elapsedTime / 1000} sec, ${JSON.stringify(areaCodeCount, 0, 2)}`,
        )
      return log({ phonesToGenerate: phones, countryCode, cnam }, t.phoneGenTimeout, res)
    }

    if (noHitCount > phoneGenStopAtNoXHits) {
      bot && bot.sendMessage(chatId, t.phoneGenNoGoodHits)
      bot &&
        bot.sendMessage(
          TELEGRAM_ADMIN_CHAT_ID,
          `${t.phoneGenNoGoodHits} ElapsedTime ${elapsedTime / 1000} sec, ${JSON.stringify(areaCodeCount, 0, 2)}`,
        )
      return log({ phonesToGenerate: phones, countryCode, cnam }, t.phoneGenNoGoodHits, res)
    }
  }

  log(
    'elapsedTime',
    elapsedTime / 1000,
    'seconds, total tries',
    i,
    'got',
    res.length,
    'mobile numbers',
    '\nareaCodeCount',
    areaCodeCount,
  )
  return res
}

// const phones = [
//   '13109382959',
//   '13109686187',
//   '13102276542',
//   '13107346740',
//   '13105075757',
//
//   '13108527129',
//   '13109137839',
// ]
// validatePhoneBulkFile('T-mobile', phones, '1', false).then(log) // US
// validatePhoneBulkFile('Mixed Carriers', phones, '1', true).then(log) // US

// validatePhoneBulkFile('Mixed Carriers', 10, '1', ['416'], false).then(log) // Canada

// const phones = [
// ]
// validatePhoneBulkFile('Mixed Carriers', phones, '61', false).then(log) // Australia

// const phones = [
//   '447734164682',
//   '447749053215',
//   '447731955801',
//   '447741585573',
//   '447789224036',
//   '447770070869',
//   '447759078324',
// ]
// validatePhoneBulkFile('Mixed Carriers', phones, '44', false).then(log) // UK

// validatePhoneBulkFile('Mixed Carriers', 1, '64', ['23', '24', '25', '26']).then(log) // New Zealand

module.exports = { validatePhoneBulkFile }
