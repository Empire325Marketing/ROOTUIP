#!/usr/bin/env node

/**
 * ROOTUIP Webhook Deployment Script
 * Deploys missing files via HTTP upload API
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DEPLOY_API_ENDPOINT = 'https://api.rootuip.com/deploy';
const files = [
    'dashboard.html',
    'container-tracking-interface.html',
    'api-playground.html'
];

async function uploadFile(filename) {
    return new Promise((resolve, reject) => {
        try {
            const filePath = path.join(__dirname, filename);
            
            if (!fs.existsSync(filePath)) {
                console.log(`❌ File not found: ${filename}`);
                resolve(false);
                return;
            }

            const fileContent = fs.readFileSync(filePath, 'utf8');
            const fileSize = fs.statSync(filePath).size;
            
            console.log(`📤 Uploading ${filename} (${fileSize} bytes)...`);
            
            const postData = JSON.stringify({
                filename: filename,
                content: fileContent,
                timestamp: new Date().toISOString()
            });

            const options = {
                hostname: 'api.rootuip.com',
                path: '/deploy',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'Authorization': 'Bearer ROOTUIP_DEPLOY_TOKEN'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        console.log(`✅ Successfully uploaded ${filename}`);
                        resolve(true);
                    } else {
                        console.log(`⚠️  Upload failed for ${filename}: ${res.statusCode}`);
                        resolve(false);
                    }
                });
            });

            req.on('error', (e) => {
                console.log(`❌ Upload error for ${filename}: ${e.message}`);
                resolve(false);
            });

            req.write(postData);
            req.end();
            
        } catch (error) {
            console.log(`❌ Error processing ${filename}: ${error.message}`);
            resolve(false);
        }
    });
}

async function deployFiles() {
    console.log('🚀 ROOTUIP Deployment Starting...\n');
    
    let successCount = 0;
    
    for (const filename of files) {
        const success = await uploadFile(filename);
        if (success) successCount++;
        
        // Add delay between uploads
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n📊 Deployment Summary:`);
    console.log(`✅ Successfully deployed: ${successCount}/${files.length} files`);
    
    if (successCount === files.length) {
        console.log(`🎉 All files deployed successfully!`);
        
        // Test deployed files
        console.log(`\n🔍 Testing deployed files...`);
        for (const filename of files) {
            setTimeout(() => {
                testDeployedFile(filename);
            }, 2000);
        }
    } else {
        console.log(`⚠️  Some files failed to deploy. Check logs above.`);
    }
}

function testDeployedFile(filename) {
    const testUrl = `https://rootuip.com/${filename}`;
    
    https.get(testUrl, (res) => {
        if (res.statusCode === 200) {
            console.log(`✅ ${filename} is now accessible at ${testUrl}`);
        } else {
            console.log(`❌ ${filename} still returning ${res.statusCode}`);
        }
    }).on('error', (e) => {
        console.log(`❌ Error testing ${filename}: ${e.message}`);
    });
}

// Run deployment
if (require.main === module) {
    deployFiles().catch(console.error);
}

module.exports = { uploadFile, deployFiles };