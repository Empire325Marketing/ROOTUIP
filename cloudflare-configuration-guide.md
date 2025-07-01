# CloudFlare Production Configuration for ROOTUIP

## DNS Configuration Setup

### Step 1: Add Domain to CloudFlare
1. Log into CloudFlare dashboard
2. Click "Add a Site" 
3. Enter `rootuip.com`
4. Select the Free plan (or Pro for advanced features)
5. CloudFlare will scan existing DNS records

### Step 2: Configure DNS Records

Set up these **A Records** with **Proxy Status ENABLED** (Orange Cloud ☁️):

```
Type    Name        Content         TTL     Proxy Status
A       @           145.223.73.4    Auto    Proxied ☁️
A       www         145.223.73.4    Auto    Proxied ☁️
A       app         145.223.73.4    Auto    Proxied ☁️
A       api         145.223.73.4    Auto    Proxied ☁️
A       demo        145.223.73.4    Auto    Proxied ☁️
A       customer    145.223.73.4    Auto    Proxied ☁️
```

### Step 3: Update Nameservers
1. Copy the CloudFlare nameservers provided
2. Log into your domain registrar
3. Update nameservers to CloudFlare's
4. Wait for DNS propagation (up to 24 hours)

---

## SSL/TLS Configuration

### Encryption Settings
1. Go to **SSL/TLS** → **Overview**
2. Set encryption mode to **"Full (strict)"**
3. Enable **"Always Use HTTPS"**
4. Turn on **"HTTP Strict Transport Security (HSTS)"**

### HSTS Configuration
```
Max Age: 6 months (15552000 seconds)
Include Subdomains: ✅ Yes
Preload: ✅ Yes
No-Sniff Header: ✅ Yes
```

### Edge Certificates
1. **Universal SSL**: Should auto-activate
2. **Always Use HTTPS**: ✅ On
3. **Minimum TLS Version**: 1.2
4. **Opportunistic Encryption**: ✅ On
5. **TLS 1.3**: ✅ On

---

## Security Configuration

### Firewall Rules

Create these firewall rules in order:

#### Rule 1: Block Malicious Traffic
```
Expression: (cf.threat_score gt 10)
Action: Block
Description: Block high threat score IPs
```

#### Rule 2: API Rate Limiting  
```
Expression: (http.request.uri.path contains "/api/")
Action: Rate Limit
Rate: 10 requests per minute
Description: API endpoint protection
```

#### Rule 3: Authentication Rate Limiting
```
Expression: (http.request.uri.path contains "/api/auth/")
Action: Rate Limit  
Rate: 5 requests per minute
Description: Authentication endpoint protection
```

#### Rule 4: Demo Rate Limiting
```
Expression: (http.host eq "demo.rootuip.com")
Action: Rate Limit
Rate: 30 requests per minute  
Description: Demo platform protection
```

#### Rule 5: Country Restrictions (Optional)
```
Expression: (ip.geoip.country ne "US" and ip.geoip.country ne "CA" and ip.geoip.country ne "GB")
Action: Challenge
Description: Geographic access control
```

### Security Level
- **Security Level**: Medium
- **Challenge Passage**: 30 minutes
- **Browser Integrity Check**: ✅ On

### Bot Management (Free)
- **Bot Fight Mode**: ✅ On
- **Super Bot Fight Mode**: ✅ On (Pro+ plans)

---

## Page Rules Configuration

Set up these page rules in **priority order**:

### Rule 1: API No Cache
```
URL: api.rootuip.com/*
Settings:
- Cache Level: Bypass
- Security Level: Medium
```

### Rule 2: Static Assets Cache
```  
URL: *.rootuip.com/*.{css,js,png,jpg,jpeg,gif,ico,svg,woff,woff2,ttf,eot}
Settings:
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month
- Browser Cache TTL: 1 month
```

### Rule 3: Demo API No Cache
```
URL: demo.rootuip.com/api/*
Settings:
- Cache Level: Bypass
```

### Rule 4: HTML Cache
```
URL: *.rootuip.com/*.html
Settings:
- Cache Level: Standard
- Browser Cache TTL: 4 hours
```

### Rule 5: Main Site Cache
```
URL: rootuip.com/*
Settings:
- Cache Level: Standard
- Browser Cache TTL: 4 hours
- Always Online: On
```

---

## Performance Optimization

### Speed Settings
Navigate to **Speed** → **Optimization**:

- **Auto Minify**:
  - ✅ CSS
  - ✅ JavaScript  
  - ✅ HTML
- **Brotli**: ✅ On
- **Early Hints**: ✅ On
- **Rocket Loader**: ❌ Off (can break dynamic apps)

### Caching Settings
Navigate to **Caching** → **Configuration**:

- **Caching Level**: Standard
- **Browser Cache TTL**: 4 hours
- **Always Online™**: ✅ On
- **Development Mode**: ❌ Off

### Network Settings
Navigate to **Network**:

- **HTTP/3 (with QUIC)**: ✅ On
- **0-RTT Connection Resumption**: ✅ On  
- **IPv6 Compatibility**: ✅ On
- **WebSockets**: ✅ On
- **Pseudo IPv4**: ❌ Off

---

## Advanced Features (Pro+ Plans)

### Transform Rules

#### Security Headers Rule
```javascript
// Add security headers
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

#### CORS Headers for API
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

### Load Balancing (Business+ Plans)

#### Pool Configuration
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
    "interval": 60,
    "timeout": 5,
    "retries": 2
  }
}
```

---

## Analytics & Monitoring Setup

### Web Analytics
1. Navigate to **Analytics & Logs** → **Web Analytics**
2. Enable **Web Analytics**
3. Configure **Enhanced Analytics** (Pro+ plans)

### Health Monitoring
Set up these monitors:

#### Primary Health Check
```
Monitor Type: HTTP
URL: https://rootuip.com/api/health
Check Interval: 1 minute
Request Timeout: 10 seconds
Method: GET
Expected Status: 200
```

#### API Health Check
```
Monitor Type: HTTP
URL: https://api.rootuip.com/api/health  
Check Interval: 1 minute
Request Timeout: 10 seconds
Method: GET
Expected Status: 200
```

#### Demo Health Check
```
Monitor Type: HTTP
URL: https://demo.rootuip.com/api/health
Check Interval: 5 minutes  
Request Timeout: 10 seconds
Method: GET
Expected Status: 200
```

### Notification Setup
1. **Email Alerts**: admin@rootuip.com
2. **Webhook Alerts**: Configure Slack integration
3. **Alert Triggers**:
   - Health check failures
   - High error rates (>5%)
   - SSL certificate expiration
   - Traffic anomalies

---

## Cache Optimization Rules

### Custom Cache Rules (Pro+ Plans)

#### Rule 1: Long-term Static Assets
```
Expression: (http.request.uri.path matches ".*\\.(css|js|woff2?|ttf|eot)$")
Settings:
- Cache Status: Cache
- Edge TTL: 1 year
- Browser TTL: 1 year
```

#### Rule 2: Image Caching
```
Expression: (http.request.uri.path matches ".*\\.(png|jpg|jpeg|gif|svg|webp|ico)$") 
Settings:
- Cache Status: Cache
- Edge TTL: 1 week
- Browser TTL: 1 week
```

#### Rule 3: API Bypass
```
Expression: (http.host eq "api.rootuip.com")
Settings:
- Cache Status: Bypass
```

#### Rule 4: HTML Caching
```
Expression: (http.request.uri.path matches ".*\\.html$" and http.host ne "api.rootuip.com")
Settings:
- Cache Status: Cache
- Edge TTL: 2 hours  
- Browser TTL: 2 hours
```

---

## Workers Script (Enterprise)

### Edge Computing Example
```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Add security headers
  const response = await fetch(request)
  const newResponse = new Response(response.body, response)
  
  newResponse.headers.set('X-Frame-Options', 'SAMEORIGIN')
  newResponse.headers.set('X-Content-Type-Options', 'nosniff')
  newResponse.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Log API requests
  if (url.pathname.startsWith('/api/')) {
    console.log(`API Request: ${request.method} ${url.pathname}`)
  }
  
  return newResponse
}
```

---

## Testing & Validation

### DNS Propagation Check
```bash
# Test DNS resolution
dig rootuip.com
dig app.rootuip.com  
dig api.rootuip.com
dig demo.rootuip.com
dig customer.rootuip.com

# Check CloudFlare proxy status
dig rootuip.com | grep -E "ANSWER|^rootuip"
```

### SSL Certificate Validation
```bash
# Test SSL certificates
openssl s_client -connect rootuip.com:443 -servername rootuip.com
openssl s_client -connect app.rootuip.com:443 -servername app.rootuip.com
openssl s_client -connect api.rootuip.com:443 -servername api.rootuip.com

# Check certificate chain
curl -I https://rootuip.com
```

### Performance Testing
```bash
# Test HTTP/2 support
curl -I --http2 https://rootuip.com

# Test compression
curl -H "Accept-Encoding: gzip,deflate,br" -I https://rootuip.com

# Test response times
curl -w "@curl-format.txt" -o /dev/null -s https://rootuip.com/api/health
```

Create `curl-format.txt`:
```
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
```

### Endpoint Testing
```bash
# Test all health endpoints
curl https://rootuip.com/api/health
curl https://app.rootuip.com/api/health  
curl https://api.rootuip.com/api/health
curl https://demo.rootuip.com/api/health
curl https://customer.rootuip.com/api/health

# Test rate limiting
for i in {1..20}; do curl https://api.rootuip.com/api/health; done
```

---

## Troubleshooting Common Issues

### Issue 1: SSL Certificate Problems
**Symptoms**: Mixed content warnings, certificate errors
**Solutions**:
1. Ensure all domains have valid certificates
2. Check CloudFlare SSL mode is "Full (strict)"
3. Verify origin server has valid SSL certificates
4. Clear CloudFlare cache

### Issue 2: 521 Origin Down Errors  
**Symptoms**: 521 error pages, origin server unreachable
**Solutions**:
1. Check VPS server status: `systemctl status nginx`
2. Verify firewall allows CloudFlare IPs
3. Check nginx configuration: `nginx -t`
4. Restart services: `systemctl restart nginx`

### Issue 3: High Response Times
**Symptoms**: Slow page loads, timeout errors
**Solutions**:
1. Enable CloudFlare caching for static content
2. Check origin server performance
3. Enable Brotli compression
4. Use APO (Automatic Platform Optimization)

### Issue 4: CORS Errors
**Symptoms**: API calls failing from web app
**Solutions**:
1. Configure proper CORS headers in Transform Rules
2. Ensure API subdomain allows cross-origin requests  
3. Check preflight OPTIONS handling
4. Verify allowed origins list

### Issue 5: Cache Not Working
**Symptoms**: Poor cache hit ratio, slow performance
**Solutions**:
1. Check Page Rules configuration
2. Verify Cache-Control headers from origin
3. Use Cache Insights to identify issues
4. Configure appropriate TTL values

---

## Maintenance Tasks

### Weekly Tasks
- [ ] Review security events and alerts
- [ ] Check SSL certificate status  
- [ ] Monitor cache hit ratios
- [ ] Review firewall logs
- [ ] Update security rules if needed

### Monthly Tasks  
- [ ] Review analytics and performance metrics
- [ ] Update Page Rules based on traffic patterns
- [ ] Check for new CloudFlare features
- [ ] Review and optimize caching strategies
- [ ] Update monitoring and alerting

### Quarterly Tasks
- [ ] Security audit and penetration testing
- [ ] Performance optimization review
- [ ] Disaster recovery testing
- [ ] Update incident response procedures
- [ ] Review and update documentation

---

## Quick Setup Checklist

- [ ] Add domain to CloudFlare
- [ ] Configure DNS A records with proxy enabled
- [ ] Update nameservers at registrar
- [ ] Set SSL/TLS to "Full (strict)"
- [ ] Enable "Always Use HTTPS"
- [ ] Configure HSTS settings
- [ ] Set up firewall rules
- [ ] Configure Page Rules for caching
- [ ] Enable speed optimizations
- [ ] Set up health monitoring
- [ ] Configure email alerts
- [ ] Test all subdomains
- [ ] Verify SSL certificates
- [ ] Test API endpoints
- [ ] Check performance metrics
- [ ] Enable Web Analytics

**🚀 Once configured, your ROOTUIP platform will benefit from CloudFlare's global CDN, DDoS protection, and performance optimizations!**

---

## Support & Resources

- **CloudFlare Support**: https://support.cloudflare.com
- **Community Forum**: https://community.cloudflare.com  
- **Status Page**: https://www.cloudflarestatus.com
- **Learning Center**: https://www.cloudflare.com/learning/
- **API Documentation**: https://api.cloudflare.com