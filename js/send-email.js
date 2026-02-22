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

async function sendEmail(info, response) {
  const plan = info.plan === 'Freedom Plan' ? 'Free Trial Plan' : info.plan;
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
                We are excited to inform you that your <strong>(${plan})</strong> has been successfully activated!
            </p>
            <p style="font-size: 18px; line-height: 1.6; color: #007bff;">
                You can now log in to your HostPanel and start exploring your account.
            </p>

            <table style="width: 100%; margin-top: 10px; border-collapse: separate; border-spacing: 0 10px;">
              <tr>
                  <td style="font-size: 16px; padding: 15px; background-color: #eee; border: 1px solid #ddd; border-radius: 5px;">
                      <strong>Domain:</strong> ${info.website_name}
                  </td>
              </tr>
              <tr>
                  <td style="font-size: 16px; padding: 15px; background-color: #eee; border: 1px solid #ddd; border-radius: 5px;">
                      <strong>HostPanel Username:</strong> ${response.username}
                  </td>
              </tr>
              <tr>
                  <td style="font-size: 16px; padding: 15px; background-color: #eee; border: 1px solid #ddd; border-radius: 5px;">
                      <strong>HostPanel PIN:</strong> Check your Telegram messages for the login PIN
                  </td>
              </tr>
               <tr>
                  <td style="font-size: 16px; padding: 15px; background-color: #eee; border: 1px solid #ddd; border-radius: 5px;">
                      <strong>Nameservers</strong>
                      <ul style="list-style-type: none; padding-left: 0;">
                          <li>${response.nameservers.ns1}</li>
                          <li>${response.nameservers.ns2}</li>
                      </ul>
                  </td>
              </tr>
            </table>

            <p style="font-size: 18px; margin-top: 10px; line-height: 1.6;">
                Please log in to your HostPanel to manage your website and services. 
                If you need any assistance, feel free to contact our support team.
                
                ${info.plan === 'Freedom Plan' 
                    ? `Remember, your plan will expire in 12 hours. If you like our service, 
                       consider upgrading to one of our premium plans!` 
                    : ''}
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
      to: info.email,
      subject: `🎉 Your ${plan} has been Activated!`,
      html: emailHtml,
    })

    console.log('Message sent: %s', mailResponse.messageId)
  } catch (error) {
    console.error('Error sending email:', error)
  }
}

module.exports = sendEmail