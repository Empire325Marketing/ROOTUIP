# DNS Configuration Guide for ROOTUIP.com

## Required DNS Records

### 1. Primary Domain Records

```
Type    Name    Value                   TTL
----    ----    -----                   ---
A       @       YOUR_SERVER_IP          300
A       www     YOUR_SERVER_IP          300
AAAA    @       YOUR_SERVER_IPV6        300  (if available)
AAAA    www     YOUR_SERVER_IPV6        300  (if available)
```

### 2. Subdomain Records

```
Type    Name        Value               TTL
----    ----        -----               ---
A       app         YOUR_SERVER_IP      300
A       staging     YOUR_SERVER_IP      300
A       api         YOUR_SERVER_IP      300
```

### 3. Email Configuration (MX Records)

```
Type    Name    Priority    Value                       TTL
----    ----    --------    -----                       ---
MX      @       10          mail.rootuip.com            300
MX      @       20          mail2.rootuip.com           300
A       mail    YOUR_MAIL_SERVER_IP                     300
```

### 4. Email Authentication Records

```
Type    Name            Value                                               TTL
----    ----            -----                                               ---
TXT     @               "v=spf1 ip4:YOUR_SERVER_IP include:_spf.google.com ~all"    300
TXT     _dmarc          "v=DMARC1; p=quarantine; rua=mailto:dmarc@rootuip.com"      300
TXT     mail._domainkey "v=DKIM1; k=rsa; p=YOUR_DKIM_PUBLIC_KEY"                    300
```

### 5. CDN Configuration (CloudFlare)

If using CloudFlare:
1. Enable "Proxied" (orange cloud) for A records
2. Set SSL/TLS to "Full (strict)"
3. Enable "Always Use HTTPS"
4. Configure Page Rules:
   ```
   *.rootuip.com/*
   - Cache Level: Standard
   - Edge Cache TTL: 1 month
   ```

### 6. Service Records

```
Type    Name                Value                           TTL
----    ----                -----                           ---
CNAME   autodiscover        autodiscover.outlook.com        300
CNAME   _acme-challenge     YOUR_SSL_VALIDATION_CNAME       300
```

### 7. Security Records

```
Type    Name    Value                                           TTL
----    ----    -----                                           ---
CAA     @       0 issue "letsencrypt.org"                       300
CAA     @       0 issuewild "letsencrypt.org"                   300
TXT     @       "google-site-verification=YOUR_VERIFICATION"    300
```

## DNS Provider Settings

### Recommended DNS Providers:
1. **CloudFlare** (Free tier available with CDN)
2. **Route 53** (AWS - $0.50/month per hosted zone)
3. **Google Cloud DNS** ($0.20/month per zone)

### CloudFlare Specific Settings:
```
SSL/TLS:
- Encryption Mode: Full (strict)
- Always Use HTTPS: ON
- Automatic HTTPS Rewrites: ON
- Minimum TLS Version: 1.2

Speed:
- Auto Minify: JavaScript, CSS, HTML
- Brotli: ON
- Rocket Loader: ON
- Polish: Lossy
- Mirage: ON

Caching:
- Caching Level: Standard
- Browser Cache TTL: 1 month
- Always Online: ON

Network:
- IPv6 Compatibility: ON
- WebSockets: ON
- IP Geolocation: ON

Security:
- Security Level: Medium
- Challenge Passage: 30 minutes
- Browser Integrity Check: ON
```

## Implementation Steps

1. **Login to DNS Provider**
   - Access your domain registrar or DNS provider
   - Navigate to DNS management

2. **Add A Records**
   ```bash
   # Get your server IP
   curl ifconfig.me
   ```
   Add this IP to all A records

3. **Configure Subdomains**
   - Add app, staging, and api subdomains
   - Point all to same server IP

4. **Set up Email Records**
   - Configure MX records for email
   - Add SPF, DKIM, and DMARC for authentication

5. **Enable CDN (CloudFlare)**
   - Change nameservers to CloudFlare
   - Enable proxy for A records
   - Configure security and performance settings

6. **Verify Configuration**
   ```bash
   # Check DNS propagation
   dig rootuip.com
   dig www.rootuip.com
   dig app.rootuip.com
   dig staging.rootuip.com
   
   # Check MX records
   dig MX rootuip.com
   
   # Check TXT records
   dig TXT rootuip.com
   ```

## Monitoring DNS

### Tools for DNS Monitoring:
1. **DNSChecker.org** - Global DNS propagation
2. **MXToolbox** - Email deliverability
3. **SSL Labs** - SSL certificate validation
4. **GTmetrix** - CDN performance

### Expected Results:
- DNS propagation: 15 minutes to 48 hours
- SSL certificate: Immediate after DNS propagation
- CDN activation: 5-10 minutes
- Email delivery: 24-48 hours for full propagation

## Troubleshooting

### Common Issues:

1. **DNS Not Resolving**
   - Wait for propagation (up to 48 hours)
   - Clear local DNS cache
   - Check nameserver settings

2. **SSL Certificate Errors**
   - Ensure DNS is pointing to correct IP
   - Verify port 80 is accessible
   - Check CloudFlare SSL settings

3. **Email Not Working**
   - Verify MX records
   - Check SPF/DKIM alignment
   - Test with mail-tester.com

4. **Slow Loading**
   - Enable CloudFlare CDN
   - Check TTL settings
   - Verify caching headers

## Security Best Practices

1. **Enable DNSSEC**
   - Prevents DNS spoofing
   - Available in most providers

2. **Use CAA Records**
   - Limits certificate authorities
   - Prevents unauthorized SSL certificates

3. **Monitor DNS Changes**
   - Set up alerts for DNS modifications
   - Regular audits of DNS records

4. **Implement Rate Limiting**
   - CloudFlare rate limiting
   - Fail2ban on origin server

## Contact Information

For DNS issues:
- **CloudFlare Support**: support.cloudflare.com
- **Domain Registrar**: [Your registrar support]
- **Server Admin**: admin@rootuip.com

Last Updated: [Current Date]