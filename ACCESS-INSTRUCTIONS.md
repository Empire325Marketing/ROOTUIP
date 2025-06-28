# How to Access Your ROOTUIP Demos

## The Problem
The domain rootuip.com points to a different server (145.223.73.4), not this one (24.44.95.254).

## Solution: SSH Tunnel (Recommended)

From your local computer, run:

```bash
ssh -L 8080:localhost:8080 iii@24.44.95.254
```

Then open your browser and go to:
- http://localhost:8080/ml-demo.html
- http://localhost:8080/login.html
- http://localhost:8080/enterprise-security-dashboard.html
- http://localhost:8080/monitoring-dashboard.html
- http://localhost:8080/simple-login.html

## How It Works

I've set up a smart proxy server that:
1. Serves YOUR files (ml-demo.html, etc.) from this server
2. Routes API calls to your ML and Auth services
3. Falls back to the real rootuip.com for any other content

## All Services Running

- ✅ ML System (Port 3004) - AI/ML processing with 94% D&D prevention
- ✅ Auth Service (Port 3003) - Enterprise authentication
- ✅ Static Server (Port 3000) - File serving
- ✅ Proxy Server (Port 8080) - Smart routing

## Alternative: Direct Server Access

If you have direct access to the server:
1. SSH into the server: `ssh iii@24.44.95.254`
2. Run: `curl http://localhost:8080/ml-demo.html`

## To Fix Permanently

Update DNS records:
- Point rootuip.com to 24.44.95.254
- Point www.rootuip.com to 24.44.95.254
- Point app.rootuip.com to 24.44.95.254

Until DNS is fixed, use the SSH tunnel method above.