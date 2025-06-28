# UPDATE NGINX TO SERVE YOUR FILES

The issue is that rootuip.com DNS points to another server. Here's how to fix it:

## Option 1: Update DNS (Permanent Fix)

1. **Change DNS A Records to point to THIS server:**
   - rootuip.com → 24.44.95.254
   - www.rootuip.com → 24.44.95.254
   - app.rootuip.com → 24.44.95.254

2. **After DNS propagates (5-30 minutes), your files will work at:**
   - https://rootuip.com/ml-demo.html
   - https://rootuip.com/login.html
   - etc.

## Option 2: Use the Other Server

If you have access to the server at 145.223.73.4:
1. Copy the files there
2. Set up the services there

## Option 3: Temporary Local Access

Edit your computer's hosts file:
```
24.44.95.254 rootuip.com www.rootuip.com app.rootuip.com
```

Then https://rootuip.com will hit THIS server.

## The Real Issue

- This server (24.44.95.254) has all your files and services running perfectly
- But rootuip.com DNS points to 145.223.73.4
- That's why you get 404 - you're hitting the wrong server!

## All Files Are Ready

I've already:
- ✅ Created all ML system files
- ✅ Started all services (ML, Auth, Static)
- ✅ Configured nginx properly
- ✅ Files are in the correct location

Just need DNS to point here!