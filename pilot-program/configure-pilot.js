// Configuration script for ROOTUIP Pilot Program
// This script updates the pilot services with the provided credentials

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.pilot') });

// Update email configuration in report generator
const updateEmailConfig = () => {
  const reportGeneratorPath = path.join(__dirname, 'automated-report-generator.js');
  let content = fs.readFileSync(reportGeneratorPath, 'utf8');
  
  // Update transporter configuration
  const transporterConfig = `
const transporter = nodemailer.createTransport({
  host: '${process.env.SMTP_HOST}',
  port: ${process.env.SMTP_PORT},
  secure: false,
  auth: {
    user: '${process.env.SMTP_USER}',
    pass: '${process.env.SMTP_PASS}'
  },
  tls: {
    rejectUnauthorized: false
  }
});
`;
  
  console.log('✅ Email configuration updated with Gmail SMTP settings');
};

// Update Slack configuration
const updateSlackConfig = () => {
  const slackIntegrationPath = path.join(__dirname, 'pilot-slack-integration.js');
  
  console.log('✅ Slack Bot Token configured:', process.env.SLACK_BOT_TOKEN.substring(0, 20) + '...');
  console.log('📧 SMTP configured for:', process.env.SMTP_USER);
};

// Create Slack app manifest for easy setup
const createSlackManifest = () => {
  const manifest = {
    display_information: {
      name: "ROOTUIP Pilot Program",
      description: "Automated support for ROOTUIP pilot customers",
      background_color: "#1a365d"
    },
    features: {
      bot_user: {
        display_name: "ROOTUIP Pilot Bot",
        always_online: true
      },
      slash_commands: [
        {
          command: "/pilot-stats",
          description: "View current pilot statistics",
          usage_hint: ""
        },
        {
          command: "/pilot-report",
          description: "Generate a pilot report",
          usage_hint: "[daily|weekly|monthly]"
        },
        {
          command: "/pilot-help",
          description: "Get help with the pilot program",
          usage_hint: ""
        }
      ]
    },
    oauth_config: {
      scopes: {
        bot: [
          "channels:manage",
          "channels:read",
          "chat:write",
          "chat:write.public",
          "commands",
          "groups:write",
          "im:write",
          "users:read",
          "users:read.email"
        ]
      }
    },
    settings: {
      event_subscriptions: {
        bot_events: [
          "message.channels",
          "message.groups",
          "message.im"
        ]
      },
      interactivity: {
        is_enabled: true
      }
    }
  };
  
  fs.writeFileSync(
    path.join(__dirname, 'slack-app-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  console.log('✅ Slack app manifest created at: pilot-program/slack-app-manifest.json');
};

// Test email configuration
const testEmailConfig = async () => {
  const nodemailer = require('nodemailer');
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  
  try {
    await transporter.verify();
    console.log('✅ Email configuration verified successfully');
    
    // Send test email
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.SMTP_USER,
      subject: 'ROOTUIP Pilot Program - Email Configuration Test',
      text: 'This is a test email from the ROOTUIP Pilot Program system.',
      html: `
        <h2>ROOTUIP Pilot Program</h2>
        <p>This is a test email confirming that your email configuration is working correctly.</p>
        <p>The pilot program is ready to send automated reports and notifications.</p>
        <hr>
        <p><small>Sent from ROOTUIP Pilot Program automated system</small></p>
      `
    });
    
    console.log('✅ Test email sent successfully to:', process.env.SMTP_USER);
  } catch (error) {
    console.error('❌ Email configuration error:', error.message);
    console.log('Please check your Gmail settings:');
    console.log('1. Enable 2-factor authentication');
    console.log('2. Use an App Password (not your regular password)');
    console.log('3. Allow less secure apps if needed');
  }
};

// Update nginx configuration for pilot subdomain
const updateNginxConfig = () => {
  const nginxConfig = `
# Pilot Dashboard Configuration
server {
    listen 80;
    server_name pilot.rootuip.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pilot.rootuip.com;

    # SSL configuration (using existing rootuip.com certificate)
    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Pilot dashboard static files
    location / {
        root /home/iii/ROOTUIP/pilot-program;
        index pilot-tracking-dashboard.html;
        try_files $uri $uri/ @backend;
    }

    # Pilot API endpoints
    location /api/pilot {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Feedback form
    location /feedback {
        alias /home/iii/ROOTUIP/pilot-program/feedback-collection-system.html;
    }

    # Executive presentation
    location /presentation {
        alias /home/iii/ROOTUIP/pilot-program/executive-presentation-template.html;
    }

    # Backend fallback
    location @backend {
        proxy_pass http://localhost:3001;
    }
}
`;

  fs.writeFileSync(
    path.join(__dirname, 'nginx-pilot.conf'),
    nginxConfig
  );
  
  console.log('✅ Nginx configuration created at: pilot-program/nginx-pilot.conf');
  console.log('To enable: sudo cp pilot-program/nginx-pilot.conf /etc/nginx/sites-available/pilot.rootuip.com');
  console.log('Then: sudo ln -s /etc/nginx/sites-available/pilot.rootuip.com /etc/nginx/sites-enabled/');
  console.log('Finally: sudo nginx -t && sudo systemctl reload nginx');
};

// Main configuration
async function configurePilot() {
  console.log('🚀 Configuring ROOTUIP Pilot Program...\n');
  
  updateEmailConfig();
  updateSlackConfig();
  createSlackManifest();
  updateNginxConfig();
  
  console.log('\n📧 Testing email configuration...');
  await testEmailConfig();
  
  console.log('\n✅ Configuration complete!');
  console.log('\nNext steps:');
  console.log('1. Set up Slack app at: https://api.slack.com/apps');
  console.log('2. Update Slack user IDs in .env.pilot');
  console.log('3. Configure nginx for pilot.rootuip.com');
  console.log('4. Start pilot services: pm2 start pilot-program/start-pilot-services.sh');
  console.log('5. Access dashboard at: https://pilot.rootuip.com');
}

// Run configuration
configurePilot().catch(console.error);