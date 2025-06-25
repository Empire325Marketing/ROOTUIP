// Universal UIP Logo Component
const UIPLogo = {
    // Get logo HTML with specified size and style
    getLogo: function(options = {}) {
        const defaults = {
            size: 'medium', // small, medium, large, custom
            type: 'full', // full, icon, horizontal
            theme: 'color', // color, white, dark
            link: true,
            customSize: null
        };
        
        const settings = { ...defaults, ...options };
        
        // Size mappings
        const sizes = {
            small: { icon: 32, text: 16 },
            medium: { icon: 40, text: 20 },
            large: { icon: 56, text: 28 },
            custom: { icon: settings.customSize || 40, text: (settings.customSize || 40) / 2 }
        };
        
        const currentSize = sizes[settings.size] || sizes.medium;
        
        // Logo SVG
        const logoSVG = `
            <svg width="${currentSize.icon}" height="${currentSize.icon}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="100" height="100" rx="20" fill="url(#gradient-${Date.now()})"/>
                <path d="M25 50V35C25 30 30 25 35 25H50C55 25 60 30 60 35V50C60 55 55 60 50 60H35C30 60 25 55 25 50Z" fill="white" opacity="0.9"/>
                <path d="M40 65V50C40 45 45 40 50 40H65C70 40 75 45 75 50V65C75 70 70 75 65 75H50C45 75 40 70 40 65Z" fill="white" opacity="0.7"/>
                <circle cx="50" cy="50" r="8" fill="white"/>
                <defs>
                    <linearGradient id="gradient-${Date.now()}" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#00D4AA"/>
                        <stop offset="1" stop-color="#00B894"/>
                    </linearGradient>
                </defs>
            </svg>
        `;
        
        // Text styles based on theme
        const textColors = {
            color: 'background: linear-gradient(135deg, #00D4AA 0%, #00B894 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;',
            white: 'color: white;',
            dark: 'color: #0A1628;'
        };
        
        // Build logo HTML
        let logoHTML = '';
        
        if (settings.type === 'icon') {
            logoHTML = logoSVG;
        } else if (settings.type === 'horizontal') {
            logoHTML = `
                <div style="display: flex; align-items: center; gap: ${currentSize.icon * 0.3}px;">
                    ${logoSVG}
                    <span style="font-size: ${currentSize.text}px; font-weight: 900; ${textColors[settings.theme]}">
                        Universal Integration Intelligence
                    </span>
                </div>
            `;
        } else { // full
            logoHTML = `
                <div style="display: flex; align-items: center; gap: ${currentSize.icon * 0.3}px;">
                    ${logoSVG}
                    <span style="font-size: ${currentSize.text}px; font-weight: 900; ${textColors[settings.theme]}">UIP</span>
                </div>
            `;
        }
        
        // Wrap in link if needed
        if (settings.link) {
            logoHTML = `<a href="/" style="text-decoration: none; display: inline-block;">${logoHTML}</a>`;
        }
        
        return logoHTML;
    },
    
    // Insert logo into element
    insertLogo: function(selector, options = {}) {
        const element = document.querySelector(selector);
        if (element) {
            element.innerHTML = this.getLogo(options);
        }
    },
    
    // Replace all placeholder logos
    replaceAllLogos: function() {
        // Replace all elements with class 'uip-logo'
        document.querySelectorAll('.uip-logo').forEach(el => {
            const options = {
                size: el.dataset.size || 'medium',
                type: el.dataset.type || 'full',
                theme: el.dataset.theme || 'color',
                link: el.dataset.link !== 'false'
            };
            el.innerHTML = this.getLogo(options);
        });
    },
    
    // Create favicon
    createFavicon: function() {
        const favicon = document.createElement('link');
        favicon.rel = 'icon';
        favicon.type = 'image/svg+xml';
        favicon.href = 'data:image/svg+xml,' + encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="100" height="100" rx="20" fill="url(#gradient)"/>
                <path d="M25 50V35C25 30 30 25 35 25H50C55 25 60 30 60 35V50C60 55 55 60 50 60H35C30 60 25 55 25 50Z" fill="white" opacity="0.9"/>
                <path d="M40 65V50C40 45 45 40 50 40H65C70 40 75 45 75 50V65C75 70 70 75 65 75H50C45 75 40 70 40 65Z" fill="white" opacity="0.7"/>
                <circle cx="50" cy="50" r="8" fill="white"/>
                <defs>
                    <linearGradient id="gradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#00D4AA"/>
                        <stop offset="1" stop-color="#00B894"/>
                    </linearGradient>
                </defs>
            </svg>
        `);
        
        // Remove existing favicons
        document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(el => el.remove());
        
        // Add new favicon
        document.head.appendChild(favicon);
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        UIPLogo.replaceAllLogos();
        UIPLogo.createFavicon();
    });
} else {
    UIPLogo.replaceAllLogos();
    UIPLogo.createFavicon();
}