const nodemailer = require('nodemailer')
require('dotenv').config()

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_DOMAIN,
  port: process.env.MAIL_PORT,
  auth: {
    user: process.env.MAIL_AUTH_USER,
    pass: process.env.MAIL_AUTH_PASSWORD,
  },
})

// Localized copy for the "update your nameservers" card (external domains only).
const NS_COPY = {
  en: {
    title: '🌐 Action Required — Update Your Nameservers',
    intro: (domain) => `Your domain <strong>${domain}</strong> is connected as an external domain. Update the nameservers at your domain registrar to the values below so your site goes live:`,
    steps: `Go to your domain registrar's control panel → DNS / Nameserver settings → replace the existing nameservers with the two above.`,
    note: `⏳ Your site won't be live until the nameservers are updated and fully propagate (up to 24 hours).`,
  },
  fr: {
    title: '🌐 Action requise — Mettez à jour vos serveurs de noms',
    intro: (domain) => `Votre domaine <strong>${domain}</strong> est connecté en tant que domaine externe. Mettez à jour les serveurs de noms chez votre registraire avec les valeurs ci-dessous pour que votre site soit en ligne :`,
    steps: `Accédez au panneau de votre registraire → Paramètres DNS / Serveurs de noms → remplacez les serveurs de noms existants par les deux ci-dessus.`,
    note: `⏳ Votre site ne sera pas en ligne tant que les serveurs de noms ne seront pas mis à jour et entièrement propagés (jusqu'à 24 heures).`,
  },
  zh: {
    title: '🌐 需要操作 — 更新您的域名服务器',
    intro: (domain) => `您的域名 <strong>${domain}</strong> 已作为外部域名连接。请在您的域名注册商处将域名服务器更新为以下值，以使您的网站上线：`,
    steps: `前往您的域名注册商控制面板 → DNS / 域名服务器设置 → 将现有的域名服务器替换为以上两个。`,
    note: `⏳ 在域名服务器更新并完全传播之前（最多24小时），您的网站将无法上线。`,
  },
  hi: {
    title: '🌐 कार्रवाई आवश्यक — अपने नेमसर्वर अपडेट करें',
    intro: (domain) => `आपका डोमेन <strong>${domain}</strong> एक बाहरी डोमेन के रूप में कनेक्ट किया गया है। अपनी साइट को लाइव करने के लिए अपने डोमेन रजिस्ट्रार पर नेमसर्वर को नीचे दिए गए मानों में अपडेट करें:`,
    steps: `अपने डोमेन रजिस्ट्रार के कंट्रोल पैनल पर जाएं → DNS / नेमसर्वर सेटिंग्स → मौजूदा नेमसर्वर को ऊपर दिए गए दोनों से बदलें।`,
    note: `⏳ जब तक नेमसर्वर अपडेट और पूरी तरह प्रसारित नहीं हो जाते (24 घंटे तक), आपकी साइट लाइव नहीं होगी।`,
  },
}

function buildNameserverCard(info) {
  const isExternal = info._isExternalDomain || info.connectExternalDomain
  const ns = Array.isArray(info.cfNameservers) ? info.cfNameservers : []
  if (!isExternal || ns.length < 2) return ''

  const lang = info.userLanguage || 'en'
  const c = NS_COPY[lang] || NS_COPY.en

  return `
              <!-- Nameserver Action (external domain) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-radius: 12px; border: 1px solid #fcd34d; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="margin: 0 0 12px; font-size: 16px; color: #92400e; text-transform: uppercase; letter-spacing: 1px;">${c.title}</h2>
                    <p style="margin: 0 0 16px; font-size: 14px; color: #78350f; line-height: 1.6;">${c.intro(info.website_name)}</p>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(146,64,14,0.15);">
                          <span style="color: #92400e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">NS1</span><br>
                          <span style="color: #1a1a2e; font-size: 16px; font-weight: 600; font-family: 'Courier New', monospace; background: #fff; padding: 2px 8px; border-radius: 4px;">${ns[0]}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0;">
                          <span style="color: #92400e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">NS2</span><br>
                          <span style="color: #1a1a2e; font-size: 16px; font-weight: 600; font-family: 'Courier New', monospace; background: #fff; padding: 2px 8px; border-radius: 4px;">${ns[1]}</span>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 16px 0 8px; font-size: 13px; color: #78350f; line-height: 1.6;">${c.steps}</p>
                    <p style="margin: 0; font-size: 13px; color: #b45309; line-height: 1.6; font-weight: 600;">${c.note}</p>
                  </td>
                </tr>
              </table>
`
}

function buildEmailHtml(info, response, pin) {
  const plan = info.plan || 'Hosting Plan'
  const panelDomain = process.env.PANEL_DOMAIN
  const panelUrl = panelDomain
    ? (panelDomain.startsWith('http') ? panelDomain : `https://${panelDomain}`)
    : `${(process.env.SELF_URL_PROD || '').replace('/api', '')}/panel`
  const brandName = process.env.CHAT_BOT_BRAND || 'Nomadly'
  const supportLink = process.env.APP_SUPPORT_LINK || '#'

  // Determine duration from plan name
  let duration = ''
  if (plan.includes('1-Week') || plan.includes('Weekly')) duration = '1 Week'
  else if (plan.includes('1-Month') || plan.includes('Monthly')) duration = '1 Month'
  else if (plan.includes('3-Month')) duration = '3 Months'
  else if (plan.includes('6-Month')) duration = '6 Months'
  else if (plan.includes('1-Year') || plan.includes('Yearly')) duration = '1 Year'
  else duration = 'See your plan details'

  const nameserverCard = buildNameserverCard(info)

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f0f2f5; font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f2f5; padding: 30px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0;">
              <div style="font-size: 48px; margin-bottom: 10px;">🚀</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Your Hosting is Live!</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 15px;">${plan} activated for <strong>${info.website_name}</strong></p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 35px 30px;">

              <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 25px;">
                Hello <strong>${info.username || 'there'}</strong>,<br>
                Your hosting account is ready. Here are your login details — please save them securely.
              </p>

              <!-- Credentials Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f5f7ff 0%, #ede9fe 100%); border-radius: 12px; border: 1px solid #e0d4fd; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="margin: 0 0 18px; font-size: 16px; color: #764ba2; text-transform: uppercase; letter-spacing: 1px;">🔐 Login Details</h2>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(118,75,162,0.15);">
                          <span style="color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Domain</span><br>
                          <span style="color: #1a1a2e; font-size: 16px; font-weight: 600;">${info.website_name}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(118,75,162,0.15);">
                          <span style="color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Plan</span><br>
                          <span style="color: #1a1a2e; font-size: 16px; font-weight: 600;">${plan}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(118,75,162,0.15);">
                          <span style="color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Duration</span><br>
                          <span style="color: #1a1a2e; font-size: 16px; font-weight: 600;">${duration}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(118,75,162,0.15);">
                          <span style="color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Username</span><br>
                          <span style="color: #1a1a2e; font-size: 16px; font-weight: 600; font-family: 'Courier New', monospace; background: #fff; padding: 2px 8px; border-radius: 4px;">${response.username}</span>
                        </td>
                      </tr>${pin ? `
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(118,75,162,0.15);">
                          <span style="color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">PIN</span><br>
                          <span style="color: #764ba2; font-size: 20px; font-weight: 700; font-family: 'Courier New', monospace; background: #fff; padding: 2px 10px; border-radius: 4px; letter-spacing: 3px;">${pin}</span>
                        </td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding: 10px 0;">
                          <span style="color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Hosting Panel</span><br>
                          <a href="${panelUrl}" style="color: #667eea; font-size: 16px; font-weight: 600; text-decoration: none;">${panelUrl}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
${nameserverCard}
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
                <tr>
                  <td align="center">
                    <a href="${panelUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.3px;">Login to Panel →</a>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff7ed; border-radius: 10px; border: 1px solid #fed7aa; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <p style="margin: 0; font-size: 14px; color: #9a3412; line-height: 1.6;">
                      🔒 <strong>Keep these credentials safe.</strong> Do not share your PIN with anyone. We will never ask for it.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 0;">
                Need help? <a href="${supportLink}" style="color: #667eea; text-decoration: none; font-weight: 600;">Contact Support</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #1a1a2e; padding: 25px 30px; text-align: center; border-radius: 0 0 16px 16px;">
              <p style="margin: 0 0 5px; color: rgba(255,255,255,0.7); font-size: 13px;">
                Sent by <strong style="color: #fff;">${brandName}</strong>
              </p>
              <p style="margin: 0; color: rgba(255,255,255,0.4); font-size: 12px;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

async function sendEmail(info, response, pin) {
  const plan = info.plan || 'Hosting Plan'
  const brandName = process.env.CHAT_BOT_BRAND || 'Nomadly'
  const emailHtml = buildEmailHtml(info, response, pin)

  try {
    const mailResponse = await transporter.sendMail({
      from: `${brandName} <${process.env.MAIL_SENDER}>`,
      to: info.email,
      subject: `🚀 Your ${plan} is Live — Login Details Inside`,
      html: emailHtml,
    })

    console.log('[Email] Hosting credentials sent to %s (messageId: %s)', info.email, mailResponse.messageId)
  } catch (error) {
    console.error('[Email] Error sending hosting credentials:', error)
  }
}

module.exports = sendEmail
module.exports.buildEmailHtml = buildEmailHtml
module.exports.buildNameserverCard = buildNameserverCard
