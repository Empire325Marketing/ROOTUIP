# CloudFlare DNS Configuration for ROOTUIP Production

## DNS Records Setup

Configure these DNS records in your CloudFlare dashboard for `rootuip.com`:

### A Records (Proxied - Orange Cloud ☁️)
```
Type    Name        Content         TTL     Proxy Status
A       @           145.223.73.4    Auto    Proxied ☁️
A       www         145.223.73.4    Auto    Proxied ☁️
A       app         145.223.73.4    Auto    Proxied ☁️
A       api         145.223.73.4    Auto    Proxied ☁️
A       demo        145.223.73.4    Auto    Proxied ☁️
A       customer    145.223.73.4    Auto    Proxied ☁️
```

## Page Rules Configuration

Set up these page rules in order of priority:

### 1. API No Cache Rule
- **URL Pattern:** `api.rootuip.com/*`
- **Settings:**
  - Cache Level: Bypass
  - Security Level: Medium

### 2. Static Assets Caching
- **URL Pattern:** `*.rootuip.com/*.{css,js,png,jpg,jpeg,gif,ico,svg,woff,woff2}`
- **Settings:**
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Browser Cache TTL: 1 month

### 3. Demo API No Cache
- **URL Pattern:** `demo.rootuip.com/api/*`
- **Settings:**
  - Cache Level: Bypass

### 4. Main Site Selective Cache
- **URL Pattern:** `rootuip.com/*`
- **Settings:**
  - Cache Level: Standard
  - Browser Cache TTL: 4 hours

## SSL/TLS Configuration

### Encryption Mode
- **Setting:** Full (strict)
- **Minimum TLS Version:** 1.2
- **Always Use HTTPS:** On
- **HSTS:** Enabled
  - Max Age: 6 months
  - Include subdomains: Yes
  - Preload: Yes

### Edge Certificates
- **Universal SSL:** Enabled
- **Always Use HTTPS:** On
- **HTTP Strict Transport Security (HSTS):** Enabled

## Security Settings

### Firewall Rules

#### 1. Block Malicious Traffic
```
Field: Threat Score
Operator: Greater than
Value: 10
Action: Block
```

#### 2. API Rate Limiting
```
Field: URI Path
Operator: contains
Value: /api/
Action: Rate Limit
Rate: 10 requests per minute per IP
```

#### 3. Demo Protection
```
Field: URI Path
Operator: contains
Value: /demo/api/
Action: Rate Limit  
Rate: 30 requests per minute per IP
```

#### 4. Country Restrictions (Optional)
```
Field: Country
Operator: not in
Value: [Your allowed countries]
Action: Challenge
```

### Security Level
- **Level:** Medium
- **Challenge Passage:** 30 minutes
- **Browser Integrity Check:** On

### Bot Management
- **Bot Fight Mode:** On (Free plan)
- **Super Bot Fight Mode:** On (Pro+ plans)

## Performance Optimization

### Speed Settings
- **Auto Minify:**
  - CSS: ✅ On
  - JavaScript: ✅ On  
  - HTML: ✅ On
- **Brotli:** ✅ On
- **Early Hints:** ✅ On
- **Rocket Loader:** ⚠️ Off (can break dynamic content)

### Caching Settings
- **Caching Level:** Standard
- **Browser Cache TTL:** 4 hours
- **Always Online™:** On
- **Development Mode:** Off

### Network Settings
- **HTTP/3 (with QUIC):** ✅ On
- **0-RTT Connection Resumption:** ✅ On
- **IPv6 Compatibility:** ✅ On
- **WebSockets:** ✅ On
- **Pseudo IPv4:** Off

## Advanced Configuration

### Transform Rules (Enterprise/Pro)

#### 1. Security Headers
```javascript
// Response Header Modification
{
  "expression": "true",
  "action": "rewrite",
  "action_parameters": {
    "headers": {
      "X-Frame-Options": {
        "operation": "set",
        "value": "SAMEORIGIN"
      },
      "X-Content-Type-Options": {
        "operation": "set", 
        "value": "nosniff"
      },
      "Referrer-Policy": {
        "operation": "set",
        "value": "strict-origin-when-cross-origin"
      }
    }
  }
}
```

#### 2. CORS Headers for API
```javascript
// For api.rootuip.com
{
  "expression": "http.host eq \"api.rootuip.com\"",
  "action": "rewrite",
  "action_parameters": {
    "headers": {
      "Access-Control-Allow-Origin": {
        "operation": "set",
        "value": "https://app.rootuip.com"
      },
      "Access-Control-Allow-Methods": {
        "operation": "set",
        "value": "GET, POST, PUT, DELETE, OPTIONS"
      },
      "Access-Control-Allow-Headers": {
        "operation": "set",
        "value": "Authorization, Content-Type, X-Requested-With"
      }
    }
  }
}
```

## Analytics & Monitoring

### Analytics Configuration
- **Web Analytics:** ✅ Enabled
- **Enhanced Analytics:** ✅ Enabled (Pro+)
- **Bot Analytics:** ✅ Enabled

### Alerts & Notifications
Set up these alerts:

#### 1. Health Check Alert
- **Type:** HTTP Monitor
- **URL:** `https://rootuip.com/api/health`
- **Check Interval:** 1 minute
- **Alert Method:** Email
- **Recipients:** admin@rootuip.com

#### 2. Certificate Expiration
- **Type:** SSL Certificate
- **Domain:** rootuip.com
- **Alert Before:** 30 days
- **Alert Method:** Email

#### 3. Traffic Spike Alert
- **Type:** Traffic Anomaly
- **Threshold:** 500% increase
- **Duration:** 5 minutes
- **Alert Method:** Email + Webhook

## Load Balancing (Pro+ Feature)

If you need load balancing for multiple servers:

### Pool Configuration
```json
{
  "name": "rootuip-pool",
  "origins": [
    {
      "name": "primary",
      "address": "145.223.73.4",
      "enabled": true,
      "weight": 1
    }
  ],
  "monitor": {
    "type": "http",
    "method": "GET",
    "path": "/api/health",
    "expected_codes": "200",
    "interval": 60
  }
}
```

## CDN Cache Optimization

### Custom Cache Rules
```
# For main assets
*.rootuip.com/*.{css,js} - Cache Everything, 1 month

# For images  
*.rootuip.com/*.{png,jpg,gif,svg,webp} - Cache Everything, 1 week

# For fonts
*.rootuip.com/*.{woff,woff2,ttf,eot} - Cache Everything, 1 month

# For API responses
api.rootuip.com/* - Bypass Cache

# For dynamic content
*.rootuip.com/*.{html,php} - Standard Cache, 2 hours
```

## Troubleshooting

### Common Issues

#### 1. SSL Certificate Not Working
- Verify all DNS records are proxied (orange cloud)
- Check if Universal SSL is enabled
- Wait up to 24 hours for certificate issuance

#### 2. Site Not Loading
- Check if DNS records point to correct IP (145.223.73.4)
- Verify proxy status is enabled
- Test origin server directly

#### 3. API CORS Issues
- Ensure API subdomain has proper CORS headers
- Check firewall rules aren't blocking legitimate requests
- Verify transform rules are correctly configured

#### 4. Performance Issues
- Review cache hit ratio in Analytics
- Check if minification is causing issues
- Verify origin server performance

### Testing Commands

```bash
# Test DNS resolution
dig rootuip.com
dig app.rootuip.com
dig api.rootuip.com

# Test SSL certificate
openssl s_client -connect rootuip.com:443 -servername rootuip.com

# Test HTTP/2
curl -I --http2 https://rootuip.com

# Test specific endpoints
curl -v https://rootuip.com/api/health
curl -v https://demo.rootuip.com/api/health
```

## Security Best Practices

### 1. WAF Custom Rules
Create custom rules for:
- SQL injection protection
- XSS attack prevention
- Directory traversal blocking
- Suspicious user agent blocking

### 2. Rate Limiting Strategy
- API endpoints: 10 req/min per IP
- Demo endpoints: 30 req/min per IP
- Static assets: No limit
- Authentication: 5 attempts per 15 min

### 3. IP Reputation
- Block known malicious IPs
- Challenge suspicious traffic
- Allow trusted IPs (office, partners)

### 4. DDoS Protection
- CloudFlare automatically provides DDoS protection
- Consider upgrading for advanced DDoS features
- Set up notifications for attack alerts

---

## Quick Setup Checklist

- [ ] Add all DNS A records with proxy enabled
- [ ] Configure SSL/TLS to Full (strict)
- [ ] Enable Always Use HTTPS
- [ ] Set up Page Rules for caching
- [ ] Configure Firewall Rules
- [ ] Enable Speed optimizations
- [ ] Set up Health Check monitoring
- [ ] Configure email alerts
- [ ] Test all subdomains
- [ ] Verify SSL certificates
- [ ] Check performance metrics

**🚀 Once configured, your ROOTUIP platform will benefit from CloudFlare's global CDN, security, and performance optimizations!**