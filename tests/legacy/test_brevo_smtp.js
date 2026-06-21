#!/usr/bin/env node
/**
 * Test Brevo SMTP credentials from Railway production .env
 */
const nodemailer = require('nodemailer')
require('dotenv').config()

console.log('\n━━━ Testing Brevo SMTP Credentials ━━━\n')
console.log('MAIL_DOMAIN:', process.env.MAIL_DOMAIN)
console.log('MAIL_PORT:', process.env.MAIL_PORT)
console.log('MAIL_AUTH_USER:', process.env.MAIL_AUTH_USER)
console.log('MAIL_AUTH_PASSWORD:', process.env.MAIL_AUTH_PASSWORD ? '***' + process.env.MAIL_AUTH_PASSWORD.slice(-4) : '(not set)')
console.log('MAIL_SENDER:', process.env.MAIL_SENDER)

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_DOMAIN,
  port: parseInt(process.env.MAIL_PORT),
  auth: {
    user: process.env.MAIL_AUTH_USER,
    pass: process.env.MAIL_AUTH_PASSWORD,
  },
  debug: true,  // Enable debug output
})

async function testConnection() {
  try {
    console.log('\n🔍 Verifying connection...')
    await transporter.verify()
    console.log('✅ SMTP connection verified successfully!')
    
    console.log('\n📧 Sending test email...')
    const info = await transporter.sendMail({
      from: `"Nomadly Test" <${process.env.MAIL_SENDER}>`,
      to: process.env.MAIL_SENDER,  // Send to self for testing
      subject: 'SMTP Test - ' + new Date().toISOString(),
      text: 'This is a test email to verify Brevo SMTP credentials.',
      html: '<div style="font-family:sans-serif;padding:20px"><h2>SMTP Test</h2><p>This is a test email to verify Brevo SMTP credentials.</p><p>Sent at: ' + new Date().toISOString() + '</p></div>',
    })
    
    console.log('✅ Test email sent successfully!')
    console.log('Message ID:', info.messageId)
    console.log('Response:', info.response)
    
  } catch (error) {
    console.error('\n❌ SMTP Test Failed:')
    console.error('Error Code:', error.code)
    console.error('Error Message:', error.message)
    console.error('Response Code:', error.responseCode)
    console.error('Command:', error.command)
    
    if (error.response) {
      console.error('Server Response:', error.response)
    }
    
    console.error('\n💡 Possible Solutions:')
    console.error('1. Verify MAIL_AUTH_USER and MAIL_AUTH_PASSWORD in Railway env vars')
    console.error('2. Check if Brevo account is active: https://app.brevo.com')
    console.error('3. Verify SMTP API key hasn\'t expired or been regenerated')
    console.error('4. Check Brevo account daily sending limits')
    
    process.exit(1)
  }
}

testConnection()
