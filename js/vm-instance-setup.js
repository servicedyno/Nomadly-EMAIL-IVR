require('dotenv').config()
const axios = require('axios')
const crypto = require('crypto')
const nodemailer = require('nodemailer')
require('dotenv').config()

const NAMEWORD_BASE_URL = process.env.NAMEWORD_BASE_URL
const X_API_KEY = process.env.NAMEWORD_API_KEY
const VM_PROJECT_ID = process.env.GOOGLE_CONSOLE_PROJECTID
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

const headers = {
  accept: 'application/json',
  'content-type': 'application/json',
  'x-api-key': X_API_KEY,
}

async function fetchAvailableCountries() {
  try {
    const url = `${NAMEWORD_BASE_URL}/areas?projectId=${VM_PROJECT_ID}`
    let response = await axios.get(url, { headers })
    if (response?.data?.data) {
      const areas = response?.data?.data.map(item => item.area)
      return areas
    }
    return false
  } catch (err) {
    console.log('Error in fetching address list', err?.response?.data)
    return false
  }
}

async function fetchAvailableRegionsOfCountry(country) {
  try {
    const url = `${NAMEWORD_BASE_URL}/regions?projectId=${VM_PROJECT_ID}&area=${country}`

    let response = await axios.get(url, { headers })
    if (response?.data?.data) {
      const areas = response?.data?.data.map(({ value, label }) => ({ value, label }))
      return areas
    }
    return false
  } catch (err) {
    console.log('Error in fetching region list', err?.response?.data)
    return false
  }
}

async function fetchAvailableZones(region) {
  try {
    const url = `${NAMEWORD_BASE_URL}/zones?projectId=${VM_PROJECT_ID}&region=${region}`

    let response = await axios.get(url, { headers })
    if (response?.data?.data) {
      const areas = response?.data?.data.map(({ name, label }) => ({ name, label }))
      return areas
    }
    return false
  } catch (err) {
    console.log('Error in fetching zone list', err?.response?.data)
    return false
  }
}

async function fetchAvailableDiskTpes(zone) {
  try {
    const url = `${NAMEWORD_BASE_URL}/vps-disk/all`
    let response = await axios.get(url, { headers })
    if (response?.data?.data) {
      return response?.data?.data
    }
    return false
  } catch (err) {
    console.log('Error in fetching Disk types', err?.response?.data)
    return false
  }
}

async function fetchAvailableVPSConfigs(telegramId, vpsDetails) {
  try {
    const url = `${NAMEWORD_BASE_URL}/vps-plan/all?region=${vpsDetails.region}&diskType=${vpsDetails.diskType}&telegramId=${telegramId}`
    let response = await axios.get(url, { headers })
    if (response?.data?.data) {
      return response?.data?.data
    }
    return false
  } catch (err) {
    console.log('Error in fetching VPS config types', err?.response?.data)
    return false
  }
}

function generateRandomName(prefix, number = 12) {
  const randomSuffix = crypto.randomBytes(number).toString('hex').substring(0, 12)
  return `${prefix}-${randomSuffix}`
}

function generateRandomPassword(length = 16) {
  const upperCase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowerCase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*()'
  const allCharacters = upperCase + lowerCase + numbers + symbols

  // Helper function to get cryptographically secure random index
  const getRandomIndex = (max) => {
    const randomBuffer = crypto.randomBytes(4)
    const randomNumber = randomBuffer.readUInt32BE(0)
    return randomNumber % max
  }

  // Ensure at least one character from each set
  let password = [
    upperCase[getRandomIndex(upperCase.length)],
    lowerCase[getRandomIndex(lowerCase.length)],
    numbers[getRandomIndex(numbers.length)],
    symbols[getRandomIndex(symbols.length)],
  ]

  // Fill remaining length with random characters
  for (let i = password.length; i < length; i++) {
    password.push(allCharacters[getRandomIndex(allCharacters.length)])
  }

  // Shuffle password array using Fisher-Yates algorithm with crypto random
  for (let i = password.length - 1; i > 0; i--) {
    const j = getRandomIndex(i + 1)
    ;[password[i], password[j]] = [password[j], password[i]]
  }

  return password.join('')
}

async function fetchSelectedCpanelOptions(cpanel) {
  try {
    let url = `${NAMEWORD_BASE_URL}/vm/${cpanel.name}`

    let response = await axios.get(url, { headers })
    if (response?.data?.data) {
      return response?.data?.data
    }
    return false
  } catch (err) {
    console.log('Error in fetching seleted cpanel options', err?.response?.data)
    return false
  }
}

async function fetchAvailableOS(cpanel) {
  try {
    let url = `${NAMEWORD_BASE_URL}/list-os`
    if (cpanel) {
      url += `?cPanel=${cpanel.name}`
    }

    let response = await axios.get(url, { headers })
    if (response?.data?.data) {
      return response?.data?.data
    }
    return false
  } catch (err) {
    console.log('Error in fetching available OS', err?.response?.data)
    return false
  }
}

async function registerVpsTelegram(telegramId, email) {
  try {
    const url = `${NAMEWORD_BASE_URL}/auth/register-telegram-user`

    console.log('#User register for telegram:', telegramId, email)
    let response = await axios.post(
      url,
      {
        email: email,
        telegramId: telegramId,
      },
      { headers },
    )
    if (response?.data) {
      return response?.data
    }
    return false
  } catch (err) {
    console.log('Error in registering user', err?.response?.data)
    if (err?.response?.data?.error && err?.response?.data?.error.includes('already exists')) {
      return true
    }
    return false
  }
}

async function checkMissingEmailForNameword(telegramId) {
  try {
    const url = `${NAMEWORD_BASE_URL}/auth/check-missing-email?telegramId=${telegramId}`

    let response = await axios.get(url, { headers })
    if (response?.data) {
      return response?.data
    }
    return false
  } catch (err) {
    console.log('Error in checking mail for user', err?.response?.data)
    return false
  }
}

async function addUserEmailForNameWord(telegramId, email) {
  try {
    const url = `${NAMEWORD_BASE_URL}/auth/update-user`

    let response = await axios.post(
      url,
      {
        email,
        telegramId,
      },
      { headers },
    )
    if (response?.data) {
      return response?.data
    }
    return false
  } catch (err) {
    console.log('Error in updating user email', err?.response?.data)
    return false
  }
}

async function fetchUserSSHkeyList(telegramId, vpsId) {
  try {
    let url = `${NAMEWORD_BASE_URL}/ssh/retrieve-All?telegramId=${telegramId}`
    if (vpsId) {
      url += `&vps_id=${vpsId}`
    }
    let response = await axios.get(url, { headers })
    if (response?.data?.data) {
      return response?.data?.data
    }
    return false
  } catch (err) {
    console.log('Error in fetching user ssh key list', err)
    return false
  }
}

async function generateNewSSHkey(telegramId, sshName) {
  try {
    const url = `${NAMEWORD_BASE_URL}/ssh/generate`

    let response = await axios.post(
      url,
      {
        telegramId,
        sshKeyName: sshName ? sshName : generateRandomName('ssh-key'),
      },
      { headers },
    )
    if (response?.data) {
      return response?.data
    }
    return false
  } catch (err) {
    console.log('Error in generating user ssh key', err?.response?.data)
    return false
  }
}

async function uploadSSHPublicKey(telegramId, key, sshName) {
  try {
    const url = `${NAMEWORD_BASE_URL}/ssh/upload-key`

    let response = await axios.post(
      url,
      {
        telegramId,
        sshKeyName: sshName ? sshName : generateRandomName('ssh-key'),
        publicKey: key,
      },
      { headers },
    )
    if (response?.data) {
      return response?.data
    }
    return false
  } catch (err) {
    console.log('Error in uploading SSH Public key', err?.response?.data)
    return false
  }
}

async function createVPSInstance(telegramId, vpsDetails) {
  try {
    const vpsList = await fetchUserVPSList(telegramId)
    let newVpsCount = 1
    if (vpsList.length) {
      const lastVpsName = vpsList[vpsList.length - 1].name
      newVpsCount = parseInt(lastVpsName.split('-')[2]) + 1
    }
    const url = `${NAMEWORD_BASE_URL}/create/vps`
    let payload = {
      label: `VM-Instance-${newVpsCount}`,
      vps_name: generateRandomName('vm-instance'),
      telegramId: telegramId,
      planId: vpsDetails.config._id,
      billingCycleId: vpsDetails.billingCycleId,
      osId: vpsDetails.os.id,
      diskTypeId: vpsDetails.diskTypeId,
      price:
        Number(vpsDetails.plantotalPrice) + Number(vpsDetails.selectedOSPrice) + Number(vpsDetails.selectedCpanelPrice),
      zone: vpsDetails.zone,
      googleConsoleProjectId: VM_PROJECT_ID,
      telegramBotToken: TELEGRAM_BOT_TOKEN,
      autoRenewable: vpsDetails.plan === 'Hourly' ? true : vpsDetails.autoRenewalPlan,
    }
    if (vpsDetails.panel) {
      payload.cPanelPlanId = vpsDetails.panel.id
    }
    console.log(payload)
    const response = await axios.post(url, payload, { headers })
    if (response?.data?.data) {
      console.log(response?.data.data)
      return { success: true, data: response?.data?.data }
    } else {
      let errorMessage = `Issue in buying VPS Plan ${response?.data?.responseMsg?.message}`
      console.error(errorMessage)
      return { error: errorMessage }
    }
  } catch (error) {
    const errorMessage = `Error in creating VMS instancw ${error.message} ${JSON.stringify(
      error?.response?.data,
      null,
      2,
    )}`
    console.error(errorMessage)
    return { error: errorMessage }
  }
}

async function attachSSHKeysToVM(payload) {
  try {
    const url = `${NAMEWORD_BASE_URL}/attach/sshkeys/${payload.vpsId}`
    let newPayload = {
      project: VM_PROJECT_ID,
      zone: payload.zone,
      sshKeys: payload.sshKeys,
      telegramId: payload.telegramId,
    }
    console.log(newPayload)
    const response = await axios.post(url, newPayload, { headers })
    if (response?.data) {
      return response?.data
    }
    return false
  } catch (error) {
    console.log('Error in Attaching SSH key to VPS', error?.response?.data)
    return false
  }
}

async function createPleskResetLink(telegramId, vpsData) {
  try {
    const url = `${NAMEWORD_BASE_URL}/vm/reset-plesk-password-link?host=${vpsData.host}&os=${vpsData.subscription.osId.os_name}&telegramId=${telegramId}`
    console.log('####Plesk reset API url', url)
    const response = await axios.get(url, { headers })
    if (response?.data) {
      return response?.data
    }
    return false
  } catch (error) {
    console.log('Error in creating reset plesk link', error?.response?.data)
    return false
  }
}

async function unlinkSSHKeyFromVps(telegramId, key, vpsDetails) {
  try {
    const url = `${NAMEWORD_BASE_URL}/detach/sshkeys/${vpsDetails._id}`
    const payload = {
      project: VM_PROJECT_ID,
      zone: vpsDetails.zone,
      sshKeys: [key],
      telegramId: telegramId,
    }
    const response = await axios.delete(url, {
      headers: headers,
      data: payload,
    })
    if (response?.data) {
      return response?.data
    }
    return false
  } catch (err) {
    console.log('Error in unlinking SSH Public key from VPS', err?.response?.data)
    return false
  }
}

async function downloadSSHKeyFile(telegramId, sshKeyName) {
  try {
    const url = `${NAMEWORD_BASE_URL}/ssh/download`
    const params = {
      telegramId,
      sshKeyName,
    }
    const response = await axios.get(url, {
      headers,
      params,
      responseType: 'arraybuffer',
    })
    if (response?.data) {
      return response?.data
    }
    return false
  } catch (err) {
    console.log('Error in downloading SSH Public key from VPS', err?.response?.data)
    return false
  }
}

async function setVpsSshCredentials(host) {
  try {
    const url = `${NAMEWORD_BASE_URL}/ssh/set-password`
    let newPayload = {
      host: host,
      targetUsername: 'root',
      targetPassword: generateRandomPassword(),
    }
    console.log(newPayload)
    const response = await axios.post(url, newPayload, { headers })
    if (response?.data) {
      console.log(response?.data)
      return { success: true, data: response?.data }
    } else {
      let errorMessage = `Issue in generating password for VMS instance ${response?.data}`
      console.error(errorMessage)
      return { error: errorMessage }
    }
  } catch (error) {
    const errorMessage = `Error in generating password for VMS instance ${error.message} ${JSON.stringify(
      error?.response?.data,
      null,
      2,
    )}`
    console.error(errorMessage)
    return { error: errorMessage }
  }
}

async function fetchUserVPSList(telegramId) {
  try {
    const url = `${NAMEWORD_BASE_URL}/list/vps?telegramId=${telegramId}&project=${VM_PROJECT_ID}`

    let response = await axios.get(url, { headers })
    if (response?.data?.data) {
      return response?.data?.data
    }
    return false
  } catch (err) {
    console.log('Error in fetching user vps details', err?.response?.data)
    return false
  }
}

async function fetchVPSDetails(telegramId, vpsId) {
  try {
    const url = `${NAMEWORD_BASE_URL}/get/vps/${vpsId}?telegramId=${telegramId}&project=${VM_PROJECT_ID}`

    let response = await axios.get(url, { headers })
    if (response?.data?.data) {
      return response?.data?.data
    }
    return false
  } catch (err) {
    console.log('Error in fetching VPS details', err?.response?.data)
    return false
  }
}

async function changeVpsAutoRenewal(telegramId, vpsDetails) {
  try {
    const url = `${NAMEWORD_BASE_URL}/subscription/update/${vpsDetails.subscription_id}`

    const payload = {
      autoRenewable: !vpsDetails.autoRenewable,
      telegramId: telegramId,
    }
    const response = await axios.put(url, payload, { headers })
    if (response?.data?.data) {
      return response?.data?.data
    }
    return false
  } catch (err) {
    console.log('Error in Changing Auto renewable for VPS details', err?.response?.data)
    return false
  }
}

async function changeVpsInstanceStatus(vpsDetails, changeStatus) {
  try {
    const url = `${NAMEWORD_BASE_URL}/${changeStatus}/vps/${vpsDetails._id}`
    const payload = {
      project: VM_PROJECT_ID,
    }
    const response = await axios.post(url, payload, { headers })
    if (response?.data) {
      return { success: true, data: response?.data?.data ? response?.data?.data : response?.data }
    } else {
      let errorMessage = `Issue in changing VPS Plan status ${response?.data?.responseMsg?.message}`
      console.error(errorMessage)
      return { error: errorMessage }
    }
  } catch (error) {
    const errorMessage = `Error in changing VMS instance status to ${changeStatus} :  ${error.message} ${JSON.stringify(
      error?.response?.data,
      null,
      2,
    )}`
    console.error(error)
    return { error: errorMessage }
  }
}

async function deleteVPSinstance(chatId, vpsId) {
  try {
    const url = `${NAMEWORD_BASE_URL}/delete/vps/${vpsId}`
    const payload = {
      project: VM_PROJECT_ID,
      telegramId: chatId,
    }
    const response = await axios.delete(url, {
      headers: headers,
      data: payload,
    })
    if (response?.data) {
      return { success: true, data: response?.data?.data ? response?.data?.data : response?.data }
    } else {
      let errorMessage = `Issue in deleting VPS Plan ${response?.data?.responseMsg?.message}`
      console.error(errorMessage)
      return { error: errorMessage }
    }
  } catch (error) {
    const errorMessage = `Error in deleting VPS instance :  ${error.message} ${JSON.stringify(
      error?.response?.data,
      null,
      2,
    )}`
    console.error(error.response.data)
    return { error: errorMessage }
  }
}

async function fetchVpsUpgradeOptions(telegramId, vpsId, upgradeType = 'vps') {
  try {
    const url = `${NAMEWORD_BASE_URL}/upgrade/${upgradeType}/${vpsId}?telegramId=${telegramId}`

    const response = await axios.get(url, { headers })
    if (response?.data?.data) {
      return response?.data?.data
    }
    return false
  } catch (err) {
    console.log('Error in Changing Auto renewable for VPS details', err?.response?.data)
    return false
  }
}

async function upgradeVPSPlanType(telegramId, vpsDetails) {
  try {
    const url = `${NAMEWORD_BASE_URL}/upgrade/vps/${vpsDetails._id}`
    let payload = {
      new_plan_id: vpsDetails.upgradeOption._id,
      telegramId: telegramId,
      new_plan_price: vpsDetails.totalPrice,
      projectId: VM_PROJECT_ID,
    }
    console.log(payload)
    const response = await axios.post(url, payload, { headers })
    if (response?.data?.data) {
      console.log(response?.data.data)
      return { success: true, data: response?.data?.data }
    } else {
      let errorMessage = `Issue in Upgrading VPS Plan type ${response?.data?.responseMsg?.message}`
      console.error(errorMessage)
      return { error: errorMessage }
    }
  } catch (error) {
    const errorMessage = `Error in Upgrading VMS Plan type ${error.message} ${JSON.stringify(
      error?.response?.data,
      null,
      2,
    )}`
    console.error(errorMessage)
    return { error: errorMessage }
  }
}

async function upgradeVPSDiskType(telegramId, vpsDetails) {
  try {
    const url = `${NAMEWORD_BASE_URL}/upgrade/disk/${vpsDetails._id}`
    let payload = {
      new_disk_id: vpsDetails.upgradeOption.id,
      telegramId: telegramId,
      new_disk_price: vpsDetails.totalPrice,
      projectId: VM_PROJECT_ID,
    }
    console.log(payload)
    const response = await axios.post(url, payload, { headers })
    if (response?.data?.data) {
      console.log(response?.data.data)
      return { success: true, data: response?.data?.data }
    } else {
      let errorMessage = `Issue in Upgrading VPS Disk Type ${response?.data?.responseMsg?.message}`
      console.error(errorMessage)
      return { error: errorMessage }
    }
  } catch (error) {
    const errorMessage = `Error in upgrading VPS Disk Type ${error.message} ${JSON.stringify(
      error?.response?.data,
      null,
      2,
    )}`
    console.error(errorMessage)
    return { error: errorMessage }
  }
}

async function renewVPSPlan(telegramId, subscriptionId) {
  try {
    const url = `${NAMEWORD_BASE_URL}/subscription/renew`
    let payload = {
      subscriptionId: subscriptionId,
      telegramId: telegramId,
    }
    const response = await axios.post(url, payload, { headers })
    if (response?.data?.data) {
      console.log(response?.data.data)
      return { success: true, data: response?.data?.data }
    } else {
      let errorMessage = `Issue in Renewing VPS plan ${response?.data?.responseMsg?.message}`
      console.error(errorMessage)
      return { error: errorMessage }
    }
  } catch (error) {
    const errorMessage = `Error in Renewing VPS plan ${error.message} ${JSON.stringify(
      error?.response?.data,
      null,
      2,
    )}`
    console.error(errorMessage)
    return { error: errorMessage }
  }
}

async function renewVPSCPanel(telegramId, subscriptionId) {
  try {
    const url = `${NAMEWORD_BASE_URL}/subscription/cpanel/renew`
    let payload = {
      subscriptionId: subscriptionId,
      telegramId: telegramId,
    }
    const response = await axios.post(url, payload, { headers })
    if (response?.data?.data) {
      console.log(response?.data.data)
      return { success: true, data: response?.data?.data }
    } else {
      let errorMessage = `Issue in Renewing VPS CPanel ${response?.data?.responseMsg?.message}`
      console.error(errorMessage)
      return { error: errorMessage }
    }
  } catch (error) {
    const errorMessage = `Error in Renewing VPS CPanel ${error.message} ${JSON.stringify(
      error?.response?.data,
      null,
      2,
    )}`
    console.error(errorMessage)
    return { error: errorMessage }
  }
}

const getVpsUpgradePrice = vpsDetails => {
  switch (vpsDetails.billingCycle) {
    case 'Hourly':
      return vpsDetails.upgradeOption.hourlyPrice
    case 'Monthly':
      return vpsDetails.upgradeOption.monthlyPrice
    case 'Quarterly':
      return vpsDetails.upgradeOption.quarterlyCycle
    case 'Annually':
      return vpsDetails.upgradeOption.annuallyCycle
    default:
      break
  }
}

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_DOMAIN,
  port: process.env.MAIL_PORT,
  auth: {
    user: process.env.MAIL_AUTH_USER,
    pass: process.env.MAIL_AUTH_PASSWORD,
  },
})

async function sendVPSCredentialsEmail(info, response, vpsDetails, credentials) {
  const plan = 'VPS Plan'
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0;">🎉 Congratulations!</h1>
        </div>
        <div style="padding: 10px 20px;  background-color: #f9f9f9; border-radius: 0 0 10px 10px;">
            <p style="font-size: 18px; line-height: 1.6;">
                Hello <strong>${info.username}</strong>,
            </p>
            <p style="font-size: 18px; line-height: 1.6;">
                We are excited to inform you that your <strong style="text-transform: capitalize;">${plan}</strong> has been successfully activated!
            </p>
            <p style="font-size: 18px; line-height: 1.6; color: #007bff;">
                Here’s your order summary:
            </p>

            <table style="width: 100%; margin-top: 10px; border-collapse: separate; border-spacing: 0 10px;">
              <tr>
                  <td style="font-size: 16px; padding: 15px; background-color: #eee; border: 1px solid #ddd; border-radius: 5px;">
                      <strong>VPS Instance Name:</strong> ${response.name}
                  </td>
              </tr>
              <tr>
                  <td style="font-size: 16px; padding: 15px; background-color: #eee; border: 1px solid #ddd; border-radius: 5px;">
                      <strong>Network IP:</strong> ${response.host}
                  </td>
              </tr>
              <tr>
                  <td style="font-size: 16px; padding: 15px; background-color: #eee; border: 1px solid #ddd; border-radius: 5px;">
                      <strong>OS System:</strong> ${vpsDetails.os ? vpsDetails.os.name : 'Not Selected'}
                  </td>
              </tr>
              <tr>
                  <td style="font-size: 16px; padding: 15px; background-color: #eee; border: 1px solid #ddd; border-radius: 5px;">
                      <strong>UserName:</strong> ${credentials.username}
                  </td>
              </tr>
              <tr>
                  <td style="font-size: 16px; padding: 15px; background-color: #eee; border: 1px solid #ddd; border-radius: 5px;">
                      <strong>Password: </strong> ${credentials.password}
                  </td>
              </tr>
            </table>

            <p style="font-size: 18px; margin-top: 10px; line-height: 1.6;">
                If you need any assistance, feel free to contact our support team.
            </p>
            
            <p style="font-size: 18px; line-height: 1.6; margin-top: 15px;">
                Best regards,<br>
                Nomadly Team
            </p>
        </div>
    </div>
    `

  try {
    const mailResponse = await transporter.sendMail({
      from: process.env.MAIL_SENDER,
      to: info.userEmail,
      subject: `🎉 Your ${plan} has been Activated!`,
      html: emailHtml,
    })

    console.log('Message sent: %s', mailResponse.messageId)
  } catch (error) {
    console.error('Error sending email:', error)
  }
}

const getExpiryDateVps = plan => {
  const now = new Date()
  let expiresAt
  switch (plan) {
    case 'Hourly':
      expiresAt = new Date(now.getTime() + 1 * 60 * 60 * 1000)
      break
    case 'Monthly':
      expiresAt = new Date(now)
      expiresAt.setMonth(expiresAt.getMonth() + 1)
      break
    case 'Quaterly':
      expiresAt = new Date(now)
      expiresAt.setMonth(expiresAt.getMonth() + 3)
      break
    case 'Annually':
      expiresAt = new Date(now)
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
      break

    default:
      break
  }
  return expiresAt
}

module.exports = {
  fetchAvailableCountries,
  fetchAvailableRegionsOfCountry,
  fetchAvailableZones,
  createVPSInstance,
  sendVPSCredentialsEmail,
  getExpiryDateVps,
  changeVpsInstanceStatus,
  fetchAvailableDiskTpes,
  fetchAvailableOS,
  registerVpsTelegram,
  fetchUserSSHkeyList,
  generateNewSSHkey,
  uploadSSHPublicKey,
  fetchAvailableVPSConfigs,
  fetchSelectedCpanelOptions,
  attachSSHKeysToVM,
  fetchUserVPSList,
  fetchVPSDetails,
  deleteVPSinstance,
  setVpsSshCredentials,
  unlinkSSHKeyFromVps,
  changeVpsAutoRenewal,
  downloadSSHKeyFile,
  checkMissingEmailForNameword,
  addUserEmailForNameWord,
  createPleskResetLink,
  fetchVpsUpgradeOptions,
  getVpsUpgradePrice,
  upgradeVPSPlanType,
  upgradeVPSDiskType,
  renewVPSPlan,
  renewVPSCPanel
}
