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

async function sendEmail(info, response, pin) {
  const plan = info.plan || 'Hosting Plan'
  const panelDomain = process.env.PANEL_DOMAIN
  const panelUrl = panelDomain
    ? `https://${panelDomain}`
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

  const emailHtml = `
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
