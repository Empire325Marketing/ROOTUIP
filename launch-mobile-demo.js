/**
 * ROOTUIP Mobile Demo Launcher
 * Demonstrates all mobile implementations
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.MOBILE_DEMO_PORT || 8090;

// Serve static files
app.use(express.static('pwa'));
app.use('/mobile', express.static('mobile'));

// Mobile landing page
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ROOTUIP Mobile Solutions</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            width: 90%;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
        }
        
        h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            color: #0066CC;
            text-align: center;
        }
        
        .subtitle {
            text-align: center;
            color: #666;
            margin-bottom: 40px;
            font-size: 1.2em;
        }
        
        .mobile-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin-bottom: 40px;
        }
        
        .mobile-card {
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s, box-shadow 0.3s;
        }
        
        .mobile-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
        }
        
        .platform-icon {
            width: 60px;
            height: 60px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 15px;
            font-size: 30px;
        }
        
        .ios-icon {
            background: linear-gradient(135deg, #000000, #333333);
            color: white;
        }
        
        .android-icon {
            background: linear-gradient(135deg, #3DDC84, #2ECC71);
            color: white;
        }
        
        .react-icon {
            background: linear-gradient(135deg, #61DAFB, #3498DB);
            color: white;
        }
        
        .pwa-icon {
            background: linear-gradient(135deg, #5E35B1, #673AB7);
            color: white;
        }
        
        h2 {
            font-size: 1.5em;
            margin-bottom: 15px;
            color: #333;
        }
        
        .features {
            list-style: none;
            margin: 20px 0;
        }
        
        .features li {
            padding: 8px 0;
            color: #666;
            display: flex;
            align-items: center;
        }
        
        .features li:before {
            content: "✓";
            color: #4CAF50;
            font-weight: bold;
            margin-right: 10px;
        }
        
        .demo-button {
            display: inline-block;
            padding: 12px 30px;
            background: #0066CC;
            color: white;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 500;
            transition: background 0.3s;
            margin-top: 20px;
        }
        
        .demo-button:hover {
            background: #0052A3;
        }
        
        .demo-button.secondary {
            background: #6C757D;
        }
        
        .demo-button.secondary:hover {
            background: #5A6268;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 40px 0;
            padding: 30px;
            background: #F8F9FA;
            border-radius: 15px;
        }
        
        .stat {
            text-align: center;
        }
        
        .stat-value {
            font-size: 2.5em;
            font-weight: bold;
            color: #0066CC;
        }
        
        .stat-label {
            color: #666;
            margin-top: 5px;
        }
        
        .features-overview {
            background: #F8F9FA;
            padding: 30px;
            border-radius: 15px;
            margin: 40px 0;
        }
        
        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .feature-item {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .feature-icon {
            width: 40px;
            height: 40px;
            background: #E3F2FD;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #0066CC;
            font-size: 20px;
        }
        
        .qr-section {
            text-align: center;
            margin-top: 40px;
            padding: 30px;
            background: #F0F7FF;
            border-radius: 15px;
        }
        
        .qr-code {
            width: 200px;
            height: 200px;
            margin: 20px auto;
            background: white;
            padding: 10px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 20px;
            }
            
            h1 {
                font-size: 2em;
            }
            
            .mobile-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 ROOTUIP Mobile Solutions</h1>
        <p class="subtitle">Native apps, cross-platform solutions, and PWA for enterprise container tracking</p>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-value">4</div>
                <div class="stat-label">Platform Solutions</div>
            </div>
            <div class="stat">
                <div class="stat-value">100%</div>
                <div class="stat-label">Offline Support</div>
            </div>
            <div class="stat">
                <div class="stat-value"><1s</div>
                <div class="stat-label">Response Time</div>
            </div>
            <div class="stat">
                <div class="stat-value">99.9%</div>
                <div class="stat-label">Uptime</div>
            </div>
        </div>
        
        <div class="mobile-grid">
            <!-- iOS App -->
            <div class="mobile-card">
                <div class="platform-icon ios-icon">🍎</div>
                <h2>iOS App</h2>
                <p>Native Swift/SwiftUI application optimized for iPhone and iPad</p>
                <ul class="features">
                    <li>Face ID / Touch ID authentication</li>
                    <li>Native iOS design language</li>
                    <li>Apple Maps integration</li>
                    <li>Push notifications via APNS</li>
                    <li>Offline data sync with Core Data</li>
                </ul>
                <a href="#" class="demo-button secondary">View in App Store</a>
            </div>
            
            <!-- Android App -->
            <div class="mobile-card">
                <div class="platform-icon android-icon">🤖</div>
                <h2>Android App</h2>
                <p>Native Kotlin app with Jetpack Compose for modern Android devices</p>
                <ul class="features">
                    <li>Biometric authentication</li>
                    <li>Material Design 3</li>
                    <li>Google Maps integration</li>
                    <li>FCM push notifications</li>
                    <li>Room database for offline</li>
                </ul>
                <a href="#" class="demo-button secondary">View in Play Store</a>
            </div>
            
            <!-- React Native -->
            <div class="mobile-card">
                <div class="platform-icon react-icon">⚛️</div>
                <h2>React Native</h2>
                <p>Cross-platform app sharing 95% code between iOS and Android</p>
                <ul class="features">
                    <li>Single codebase</li>
                    <li>Native performance</li>
                    <li>Hot reload development</li>
                    <li>Native module integration</li>
                    <li>AsyncStorage offline support</li>
                </ul>
                <a href="#" class="demo-button secondary">Download APK</a>
            </div>
            
            <!-- Progressive Web App -->
            <div class="mobile-card">
                <div class="platform-icon pwa-icon">🌐</div>
                <h2>Progressive Web App</h2>
                <p>Mobile web app that works offline and installs like native</p>
                <ul class="features">
                    <li>Works on any device</li>
                    <li>Offline functionality</li>
                    <li>Push notifications</li>
                    <li>App-like experience</li>
                    <li>No app store needed</li>
                </ul>
                <a href="/pwa/mobile-app.html" class="demo-button" target="_blank">Launch PWA Demo</a>
            </div>
        </div>
        
        <div class="features-overview">
            <h2 style="text-align: center; margin-bottom: 30px;">📱 Mobile-Optimized Features</h2>
            <div class="feature-grid">
                <div class="feature-item">
                    <div class="feature-icon">📍</div>
                    <div>
                        <strong>GPS Tracking</strong>
                        <p>Real-time location updates</p>
                    </div>
                </div>
                <div class="feature-item">
                    <div class="feature-icon">📸</div>
                    <div>
                        <strong>Document Scanning</strong>
                        <p>OCR and photo upload</p>
                    </div>
                </div>
                <div class="feature-item">
                    <div class="feature-icon">🔐</div>
                    <div>
                        <strong>Biometric Auth</strong>
                        <p>Face ID & fingerprint</p>
                    </div>
                </div>
                <div class="feature-item">
                    <div class="feature-icon">📲</div>
                    <div>
                        <strong>Push Notifications</strong>
                        <p>Real-time alerts</p>
                    </div>
                </div>
                <div class="feature-item">
                    <div class="feature-icon">💾</div>
                    <div>
                        <strong>Offline Mode</strong>
                        <p>Work without internet</p>
                    </div>
                </div>
                <div class="feature-item">
                    <div class="feature-icon">📊</div>
                    <div>
                        <strong>Executive Dashboard</strong>
                        <p>Key metrics at a glance</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="qr-section">
            <h2>📱 Scan to Try Mobile App</h2>
            <p>Scan this QR code with your mobile device to access the PWA demo</p>
            <div class="qr-code">
                <svg width="180" height="180" viewBox="0 0 180 180">
                    <!-- Simplified QR code representation -->
                    <rect width="180" height="180" fill="white"/>
                    <path d="M10,10 h50 v50 h-50 Z M120,10 h50 v50 h-50 Z M10,120 h50 v50 h-50 Z" fill="black"/>
                    <path d="M20,20 h30 v30 h-30 Z M130,20 h30 v30 h-30 Z M20,130 h30 v30 h-30 Z" fill="white"/>
                    <path d="M30,30 h10 v10 h-10 Z M140,30 h10 v10 h-10 Z M30,140 h10 v10 h-10 Z" fill="black"/>
                    <text x="90" y="95" text-anchor="middle" font-size="12" fill="#666">QR Demo</text>
                </svg>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 10px;">
                URL: ${req.protocol}://${req.get('host')}/pwa/mobile-app.html
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 40px;">
            <h3 style="margin-bottom: 20px;">Ready to go mobile?</h3>
            <a href="/pwa/mobile-app.html" class="demo-button" style="font-size: 18px; padding: 15px 40px;">
                Try Mobile Web App Now
            </a>
        </div>
    </div>
</body>
</html>
    `);
});

// PWA manifest endpoint
app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'pwa', 'manifest.json'));
});

// Service worker
app.get('/service-worker.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'pwa', 'service-worker.js'));
});

// Mobile app files info
app.get('/mobile-info', (req, res) => {
    const mobileFiles = {
        ios: {
            files: [
                'mobile/ios/ROOTUIP/ContentView.swift',
                'mobile/ios/ROOTUIP/DashboardView.swift',
                'mobile/ios/ROOTUIP/ContainerTrackingView.swift',
                'mobile/ios/ROOTUIP/Models.swift',
                'mobile/ios/ROOTUIP/Info.plist'
            ],
            features: [
                'SwiftUI declarative UI',
                'Face ID/Touch ID',
                'MapKit integration',
                'Core Data offline storage',
                'Push notifications'
            ]
        },
        android: {
            files: [
                'mobile/android/app/src/main/java/com/rootuip/mobile/MainActivity.kt',
                'mobile/android/app/src/main/java/com/rootuip/mobile/ui/screens/DashboardScreen.kt',
                'mobile/android/app/src/main/java/com/rootuip/mobile/ui/screens/TrackingScreen.kt',
                'mobile/android/app/src/main/java/com/rootuip/mobile/data/Repository.kt',
                'mobile/android/app/src/main/AndroidManifest.xml'
            ],
            features: [
                'Jetpack Compose UI',
                'Biometric authentication',
                'Google Maps',
                'Room database',
                'Firebase messaging'
            ]
        },
        reactNative: {
            files: [
                'mobile/react-native/App.js',
                'mobile/react-native/screens/DashboardScreen.js',
                'mobile/react-native/screens/ContainerTrackingScreen.js',
                'mobile/react-native/screens/DocumentScanScreen.js',
                'mobile/react-native/components/BiometricAuth.js'
            ],
            features: [
                'Cross-platform code sharing',
                'React Navigation',
                'AsyncStorage',
                'Camera integration',
                'Push notifications'
            ]
        },
        pwa: {
            files: [
                'pwa/mobile-app.html',
                'pwa/service-worker.js',
                'pwa/manifest.json',
                'pwa/offline.html'
            ],
            features: [
                'Service Worker offline support',
                'Web app manifest',
                'Push notifications',
                'Background sync',
                'Install prompts'
            ]
        }
    };
    
    res.json(mobileFiles);
});

// Start server
app.listen(PORT, () => {
    console.log(`
🚀 ROOTUIP Mobile Demo Server Started!

✅ Access Points:
- Mobile Landing Page: http://localhost:${PORT}
- PWA Demo: http://localhost:${PORT}/pwa/mobile-app.html
- Mobile Info API: http://localhost:${PORT}/mobile-info

📱 Mobile Implementations:
1. iOS Native App (Swift/SwiftUI)
   - Face ID/Touch ID authentication
   - Native iOS components
   - MapKit integration
   - Offline Core Data storage

2. Android Native App (Kotlin/Jetpack Compose)
   - Material Design 3
   - Biometric authentication
   - Google Maps integration
   - Room database for offline

3. React Native Cross-Platform
   - 95% code sharing between platforms
   - Native performance
   - Unified development experience
   - Platform-specific optimizations

4. Progressive Web App (PWA)
   - Works on any mobile browser
   - Installable like native app
   - Offline functionality
   - Push notifications
   - No app store required

🔧 Key Mobile Features:
- Touch-friendly container tracking
- Mobile photo upload for documents
- GPS integration for location services
- Biometric authentication (Face ID, fingerprint)
- Mobile-optimized dashboard layouts
- Offline data synchronization
- Push notifications for alerts
- QR code scanning
- Responsive design for all screen sizes

📊 Performance Targets:
- App launch time: <2 seconds
- Offline data sync: Automatic
- Push notification delivery: <1 second
- Battery optimization: Efficient
- Data usage: Minimized with caching

🎯 User Experience:
- Executive Dashboard: Key metrics at a glance
- Field Workers: Easy container tracking
- Drivers: Route optimization
- Managers: Real-time alerts

Try the PWA demo on your mobile device for the best experience!
`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down mobile demo server...');
    process.exit(0);
});