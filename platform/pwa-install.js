// ROOTUIP PWA Installation Handler
let deferredPrompt;
let installButton;
let installBanner;

// Initialize PWA installation
function initPWAInstall() {
    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/platform/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdateBanner();
                        }
                    });
                });
            })
            .catch(error => {
                console.error('ServiceWorker registration failed:', error);
            });
    }
    
    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallUI();
    });
    
    // Listen for successful install
    window.addEventListener('appinstalled', e => {
        console.log('PWA installed successfully');
        hideInstallUI();
        trackInstallation();
    });
    
    // Check if already installed
    checkIfInstalled();
}

// Show install UI
function showInstallUI() {
    // Create install banner if it doesn't exist
    if (!installBanner) {
        createInstallBanner();
    }
    
    installBanner.style.display = 'flex';
    
    // Add install buttons to UI
    document.querySelectorAll('.pwa-install-button').forEach(button => {
        button.style.display = 'inline-block';
        button.addEventListener('click', installPWA);
    });
}

// Hide install UI
function hideInstallUI() {
    if (installBanner) {
        installBanner.style.display = 'none';
    }
    
    document.querySelectorAll('.pwa-install-button').forEach(button => {
        button.style.display = 'none';
    });
}

// Create install banner
function createInstallBanner() {
    installBanner = document.createElement('div');
    installBanner.className = 'pwa-install-banner';
    installBanner.innerHTML = `
        <div class="install-banner-content">
            <div class="install-icon">📱</div>
            <div class="install-text">
                <strong>Install ROOTUIP Platform</strong>
                <p>Get quick access and work offline</p>
            </div>
            <button class="install-btn" onclick="installPWA()">Install</button>
            <button class="dismiss-btn" onclick="dismissInstallBanner()">Not Now</button>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .pwa-install-banner {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.2);
            padding: 1rem;
            display: none;
            align-items: center;
            gap: 1rem;
            z-index: 1000;
            max-width: 90%;
            width: 400px;
            animation: slideUp 0.3s ease-out;
        }
        
        @keyframes slideUp {
            from {
                transform: translateX(-50%) translateY(100%);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
        
        .install-banner-content {
            display: flex;
            align-items: center;
            gap: 1rem;
            width: 100%;
        }
        
        .install-icon {
            font-size: 2.5rem;
            flex-shrink: 0;
        }
        
        .install-text {
            flex: 1;
            min-width: 0;
        }
        
        .install-text strong {
            display: block;
            font-size: 1.125rem;
            color: #0f172a;
            margin-bottom: 0.25rem;
        }
        
        .install-text p {
            font-size: 0.875rem;
            color: #64748b;
            margin: 0;
        }
        
        .install-btn, .dismiss-btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
        }
        
        .install-btn {
            background: #3b82f6;
            color: white;
        }
        
        .install-btn:hover {
            background: #2563eb;
        }
        
        .dismiss-btn {
            background: #e2e8f0;
            color: #475569;
        }
        
        .dismiss-btn:hover {
            background: #cbd5e1;
        }
        
        @media (max-width: 480px) {
            .pwa-install-banner {
                bottom: 10px;
                width: calc(100% - 20px);
            }
            
            .install-banner-content {
                flex-wrap: wrap;
            }
            
            .install-icon {
                display: none;
            }
        }
        
        .pwa-install-button {
            display: none;
            padding: 0.5rem 1rem;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .pwa-install-button:hover {
            background: #2563eb;
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(installBanner);
}

// Install PWA
async function installPWA() {
    if (!deferredPrompt) {
        console.log('Install prompt not available');
        return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for user response
    const { outcome } = await deferredPrompt.userChoice;
    console.log('User response:', outcome);
    
    if (outcome === 'accepted') {
        console.log('User accepted install');
    } else {
        console.log('User dismissed install');
    }
    
    // Clear the deferred prompt
    deferredPrompt = null;
    hideInstallUI();
}

// Dismiss install banner
function dismissInstallBanner() {
    hideInstallUI();
    
    // Remember dismissal for 7 days
    localStorage.setItem('pwa-install-dismissed', Date.now());
}

// Check if already installed
function checkIfInstalled() {
    // Check if running as installed PWA
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone ||
                       document.referrer.includes('android-app://');
    
    if (isInstalled) {
        console.log('PWA is already installed');
        hideInstallUI();
        return true;
    }
    
    // Check if recently dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
        const daysSinceDismissed = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < 7) {
            console.log('Install prompt recently dismissed');
            return false;
        }
    }
    
    return false;
}

// Show update banner
function showUpdateBanner() {
    const updateBanner = document.createElement('div');
    updateBanner.className = 'pwa-update-banner';
    updateBanner.innerHTML = `
        <div class="update-content">
            <span>New version available!</span>
            <button onclick="updatePWA()">Update</button>
        </div>
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        .pwa-update-banner {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #f59e0b;
            color: white;
            padding: 0.75rem;
            text-align: center;
            z-index: 1001;
            animation: slideDown 0.3s ease-out;
        }
        
        @keyframes slideDown {
            from {
                transform: translateY(-100%);
            }
            to {
                transform: translateY(0);
            }
        }
        
        .update-content {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
        }
        
        .pwa-update-banner button {
            padding: 0.25rem 1rem;
            background: white;
            color: #f59e0b;
            border: none;
            border-radius: 4px;
            font-weight: 500;
            cursor: pointer;
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(updateBanner);
}

// Update PWA
function updatePWA() {
    window.location.reload();
}

// Track installation
function trackInstallation() {
    // Send analytics event
    if (typeof gtag !== 'undefined') {
        gtag('event', 'pwa_install', {
            event_category: 'engagement',
            event_label: 'platform'
        });
    }
    
    // Store installation date
    localStorage.setItem('pwa-installed', Date.now());
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPWAInstall);
} else {
    initPWAInstall();
}

// Export for use in other scripts
window.PWAInstall = {
    install: installPWA,
    checkIfInstalled,
    showInstallUI,
    hideInstallUI
};