const { log } = require('console')
const { readFileSync } = require('fs')
const qrcode = require('qrcode-terminal')
const { date, sleep } = require('./utils')
const { customAlphabet } = require('nanoid')
const { Client, LocalAuth } = require('whatsapp-web.js')

const client = new Client({
  authStrategy: new LocalAuth(),
})

client.initialize()
client.on('qr', qr => {
  log(date(), 'QR') // log(qr)
  qrcode.generate(qr, { small: true })
})

client.on('authenticated', () => {
  log(date(), 'WhatsApp Authenticated')
})

log('Start', date())
client.on('ready', async () => {
  log(date(), 'WhatsApp is ready')
  validatePhoneWhatsappFromFile('v39.txt')
})

let wa_ok = async () => (await client.getState()) === 'CONNECTED'

const part1 = customAlphabet('23456789', 1)

const duplicate = {}

// 2 sec per phone check and after 2 minutes take a rest of 30 seconds, it will help WA number last longer

const validatePhoneWhatsappFromFile = async file => {
  const data = readFileSync(file, 'utf8')
  const phones = data.split('\n')
  const total = phones.length

  for (let i = 0; i < phones.length; i++) {
    try {
      const phone = phones[i]

      if (duplicate[phone]) {
        log(`duplicate ${phone}`) || false
        continue
      }
      duplicate[phone] = true

      await sleep(2000)

      const ok = await client.isRegisteredUser(phone)
      ok && log(`${i}/${total}, ${date()}, ${phone}`)
    } catch (error) {
      console.error('validatePhoneWhatsappFromFile error:', error?.message)
      break
    }
  }
}

const stopPhones = {}
const phonesValidateTimeout = 3 * 60 * 1000

const downloadPhoneNumbers = async () => {
  const ref = part1()
  const msg = await Promise.race([sleep(phonesValidateTimeout), validatePhoneWhatsappFromFile('v39.txt', ref)])
  stopPhones[ref] = true
  return msg
}

module.exports = { wa_ok, downloadPhoneNumbers }
