// Test email configuration for ROOTUIP Pilot Program
const nodemailer = require('nodemailer');

// Email configuration from your provided credentials
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'mjaiii@rootuip.com',
    pass: 'pqti qhre ahuv nywu' // App password
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function sendTestEmail() {
  try {
    // Verify configuration
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully');

    // Send test email
    const info = await transporter.sendMail({
      from: '"ROOTUIP Pilot Program" <mjaiii@rootuip.com>',
      to: 'mjaiii@rootuip.com',
      subject: 'ROOTUIP Pilot Program - Configuration Test ✅',
      text: 'This is a test email from the ROOTUIP Pilot Program system.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">ROOTUIP Pilot Program</h1>
            <p style="color: #cbd5e0; margin-top: 10px;">Email Configuration Test</p>
          </div>
          
          <div style="padding: 30px; background: #f5f7fa;">
            <h2 style="color: #2d3748;">✅ Configuration Successful!</h2>
            <p style="color: #4a5568; line-height: 1.6;">
              This test email confirms that your ROOTUIP Pilot Program email configuration is working correctly.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #2d3748; margin-top: 0;">System Status:</h3>
              <ul style="color: #4a5568;">
                <li>SMTP Server: smtp.gmail.com</li>
                <li>Port: 587 (TLS)</li>
                <li>From: mjaiii@rootuip.com</li>
                <li>Authentication: ✅ Successful</li>
              </ul>
            </div>
            
            <div style="background: #e6fffa; border-left: 4px solid #4fd1c5; padding: 15px; margin: 20px 0;">
              <p style="color: #234e52; margin: 0;">
                <strong>Next Steps:</strong><br>
                The pilot program can now send automated reports, alerts, and notifications to your customers.
              </p>
            </div>
            
            <p style="color: #718096; font-size: 14px; margin-top: 30px;">
              This is an automated message from the ROOTUIP Pilot Program system.<br>
              For support, contact: support@rootuip.com
            </p>
          </div>
        </div>
      `
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Check your inbox at: mjaiii@rootuip.com');

  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    
    if (error.code === 'EAUTH') {
      console.log('\n⚠️  Authentication failed. Please check:');
      console.log('1. You are using an App Password (not regular password)');
      console.log('2. 2-Step Verification is enabled on your Google account');
      console.log('3. App Password is entered correctly without spaces');
      console.log('\nTo create an App Password:');
      console.log('1. Go to https://myaccount.google.com/security');
      console.log('2. Click on "2-Step Verification"');
      console.log('3. Scroll down and click on "App passwords"');
      console.log('4. Generate a new app password for "Mail"');
    }
  }
}

// Run the test
console.log('🚀 Testing ROOTUIP Pilot Program email configuration...\n');
sendTestEmail();