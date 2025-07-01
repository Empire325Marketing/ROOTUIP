import React from 'react';

/**
 * ROOTUIP Logo Component
 * 
 * A flexible React component for displaying ROOTUIP brand logos
 * Supports multiple variants and sizes with proper accessibility
 */

const RootUILogo = ({ 
  variant = 'primary', 
  height = 60, 
  width = 'auto',
  className = '',
  darkMode = false,
  showTagline = true,
  ...props 
}) => {
  // SVG components for each logo variant
  const logos = {
    primary: (
      <svg 
        width={width === 'auto' ? (height * 3.33) : width} 
        height={height} 
        viewBox="0 0 200 60" 
        xmlns="http://www.w3.org/2000/svg"
        aria-label="ROOTUIP Ocean Freight Intelligence"
        role="img"
      >
        <defs>
          <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor: darkMode ? '#FFFFFF' : '#0F3460', stopOpacity: 1}} />
            <stop offset="100%" style={{stopColor: darkMode ? '#E0E4E8' : '#1e4d8b', stopOpacity: 1}} />
          </linearGradient>
        </defs>
        
        <g id="wave-symbol">
          <path 
            d="M5,30 Q15,20 25,30 T45,30 Q55,20 65,30" 
            stroke="url(#oceanGradient)" 
            strokeWidth="3" 
            fill="none" 
            strokeLinecap="round"
          />
          <path 
            d="M10,35 Q20,25 30,35 T50,35 Q60,25 70,35" 
            stroke="#00D46A" 
            strokeWidth="2" 
            fill="none" 
            strokeLinecap="round" 
            opacity="0.7"
          />
        </g>
        
        <text 
          x="75" 
          y="38" 
          fontFamily="Arial, sans-serif" 
          fontSize="28" 
          fontWeight="bold" 
          fill={darkMode ? '#FFFFFF' : '#0F3460'}
        >
          ROOT<tspan fill="#00D46A">UIP</tspan>
        </text>
        
        {showTagline && (
          <text 
            x="75" 
            y="50" 
            fontFamily="Arial, sans-serif" 
            fontSize="10" 
            fill={darkMode ? '#CBD5E0' : '#5D7083'} 
            letterSpacing="0.5"
          >
            OCEAN FREIGHT INTELLIGENCE
          </text>
        )}
        
        <rect x="185" y="25" width="10" height="15" fill="#FF6B35" opacity="0.8" rx="1"/>
        <rect x="185" y="22" width="10" height="2" fill="#FF6B35"/>
      </svg>
    ),
    
    icon: (
      <svg 
        width={height} 
        height={height} 
        viewBox="0 0 60 60" 
        xmlns="http://www.w3.org/2000/svg"
        aria-label="ROOTUIP Logo"
        role="img"
      >
        <defs>
          <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor: '#0F3460', stopOpacity: 1}} />
            <stop offset="100%" style={{stopColor: '#1e4d8b', stopOpacity: 1}} />
          </linearGradient>
          
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1"/>
          </filter>
        </defs>
        
        <circle cx="30" cy="30" r="28" fill={darkMode ? '#0F3460' : 'white'} filter="url(#shadow)"/>
        
        <g transform="translate(30, 30)">
          <path 
            d="M-20,0 Q-10,-8 0,0 T20,0" 
            stroke={darkMode ? '#FFFFFF' : "url(#iconGradient)"} 
            strokeWidth="4" 
            fill="none" 
            strokeLinecap="round"
          />
          
          <path 
            d="M-15,6 Q-7.5,-2 0,6 T15,6" 
            stroke="#00D46A" 
            strokeWidth="3" 
            fill="none" 
            strokeLinecap="round" 
            opacity="0.8"
          />
          
          <rect x="8" y="-10" width="6" height="8" fill="#FF6B35" rx="1"/>
          <rect x="8" y="-12" width="6" height="1.5" fill="#FF6B35"/>
        </g>
      </svg>
    ),
    
    horizontal: (
      <svg 
        width={width === 'auto' ? (height * 3.5) : width} 
        height={height} 
        viewBox="0 0 280 80" 
        xmlns="http://www.w3.org/2000/svg"
        aria-label="ROOTUIP Ocean Freight Intelligence - $500K Value Per Vessel"
        role="img"
      >
        <defs>
          <linearGradient id="horizGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{stopColor: '#0F3460', stopOpacity: 1}} />
            <stop offset="50%" style={{stopColor: '#1e4d8b', stopOpacity: 1}} />
            <stop offset="100%" style={{stopColor: '#0F3460', stopOpacity: 1}} />
          </linearGradient>
        </defs>
        
        <g transform="translate(20, 40)">
          <circle cx="0" cy="0" r="25" fill={darkMode ? '#1e4d8b' : 'white'} stroke="#0F3460" strokeWidth="1" opacity="0.1"/>
          <path 
            d="M-15,0 Q-7.5,-6 0,0 T15,0" 
            stroke={darkMode ? '#FFFFFF' : "url(#horizGradient)"} 
            strokeWidth="3" 
            fill="none" 
            strokeLinecap="round"
          />
          <path 
            d="M-12,5 Q-6,-1 0,5 T12,5" 
            stroke="#00D46A" 
            strokeWidth="2.5" 
            fill="none" 
            strokeLinecap="round" 
            opacity="0.8"
          />
          <rect x="6" y="-8" width="5" height="6" fill="#FF6B35" rx="0.5"/>
          <rect x="6" y="-9.5" width="5" height="1.2" fill="#FF6B35"/>
        </g>
        
        <text x="65" y="45" fontFamily="Arial, sans-serif" fontSize="32" fontWeight="bold">
          <tspan fill={darkMode ? '#FFFFFF' : '#0F3460'}>ROOT</tspan>
          <tspan fill="#00D46A">UIP</tspan>
        </text>
        
        <line x1="200" y1="25" x2="200" y2="55" stroke={darkMode ? '#4A5568' : '#E0E4E8'} strokeWidth="1"/>
        
        <text x="210" y="38" fontFamily="Arial, sans-serif" fontSize="11" fill={darkMode ? '#CBD5E0' : '#5D7083'}>
          <tspan x="210" dy="0">$500K VALUE</tspan>
          <tspan x="210" dy="14">PER VESSEL</tspan>
        </text>
      </svg>
    ),
    
    vertical: (
      <svg 
        width={width === 'auto' ? (height * 0.8) : width} 
        height={height} 
        viewBox="0 0 160 200" 
        xmlns="http://www.w3.org/2000/svg"
        aria-label="ROOTUIP Ocean Freight Intelligence"
        role="img"
      >
        <defs>
          <linearGradient id="vertGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{stopColor: '#0F3460', stopOpacity: 1}} />
            <stop offset="100%" style={{stopColor: '#1e4d8b', stopOpacity: 1}} />
          </linearGradient>
        </defs>
        
        <g transform="translate(80, 50)">
          <circle cx="0" cy="0" r="40" fill="none" stroke={darkMode ? '#FFFFFF' : '#0F3460'} strokeWidth="1" opacity="0.2"/>
          <circle cx="0" cy="0" r="35" fill="none" stroke="#00D46A" strokeWidth="0.5" opacity="0.3"/>
          
          <path 
            d="M-25,0 Q-12.5,-10 0,0 T25,0" 
            stroke={darkMode ? '#FFFFFF' : "url(#vertGradient)"} 
            strokeWidth="4" 
            fill="none" 
            strokeLinecap="round"
          />
          <path 
            d="M-20,8 Q-10,-2 0,8 T20,8" 
            stroke="#00D46A" 
            strokeWidth="3" 
            fill="none" 
            strokeLinecap="round" 
            opacity="0.8"
          />
          
          <g transform="translate(12, -12)">
            <rect width="8" height="10" fill="#FF6B35" rx="1" opacity="0.9"/>
            <rect y="-2" width="8" height="2" fill="#FF6B35"/>
          </g>
        </g>
        
        <text x="80" y="120" fontFamily="Arial, sans-serif" fontSize="36" fontWeight="bold" textAnchor="middle">
          <tspan fill={darkMode ? '#FFFFFF' : '#0F3460'}>ROOT</tspan>
        </text>
        <text x="80" y="150" fontFamily="Arial, sans-serif" fontSize="36" fontWeight="bold" textAnchor="middle">
          <tspan fill="#00D46A">UIP</tspan>
        </text>
        
        {showTagline && (
          <>
            <text x="80" y="175" fontFamily="Arial, sans-serif" fontSize="10" fill={darkMode ? '#CBD5E0' : '#5D7083'} textAnchor="middle" letterSpacing="1">
              OCEAN FREIGHT
            </text>
            <text x="80" y="188" fontFamily="Arial, sans-serif" fontSize="10" fill={darkMode ? '#CBD5E0' : '#5D7083'} textAnchor="middle" letterSpacing="1">
              INTELLIGENCE
            </text>
          </>
        )}
      </svg>
    )
  };

  return (
    <div className={`rootuip-logo ${className}`} {...props}>
      {logos[variant] || logos.primary}
    </div>
  );
};

// Animated Logo Component
export const RootUILogoAnimated = ({ variant = 'icon', size = 60, ...props }) => {
  return (
    <div className="rootuip-logo-animated" style={{ display: 'inline-block' }}>
      <style jsx>{`
        @keyframes wave-motion {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        
        @keyframes container-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-2px) rotate(-1deg); }
          75% { transform: translateY(2px) rotate(1deg); }
        }
        
        .rootuip-logo-animated svg path:first-child {
          animation: wave-motion 3s ease-in-out infinite;
        }
        
        .rootuip-logo-animated svg path:nth-child(2) {
          animation: wave-motion 3s ease-in-out infinite;
          animation-delay: 0.3s;
        }
        
        .rootuip-logo-animated svg rect {
          animation: container-float 4s ease-in-out infinite;
          transform-origin: center;
        }
      `}</style>
      <RootUILogo variant={variant} height={size} {...props} />
    </div>
  );
};

// Loading Spinner Component using brand elements
export const RootUILoadingSpinner = ({ size = 40, color = '#0F3460' }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 40 40" 
      xmlns="http://www.w3.org/2000/svg"
      className="rootuip-spinner"
      aria-label="Loading"
      role="status"
    >
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .rootuip-spinner {
          animation: spin 1.5s linear infinite;
        }
      `}</style>
      
      <circle 
        cx="20" 
        cy="20" 
        r="18" 
        fill="none" 
        stroke={color} 
        strokeWidth="3" 
        strokeDasharray="80 20"
        strokeLinecap="round"
        opacity="0.3"
      />
      
      <path 
        d="M20,2 A18,18 0 0,1 38,20" 
        fill="none" 
        stroke={color} 
        strokeWidth="3"
        strokeLinecap="round"
      />
      
      <circle cx="38" cy="20" r="2" fill="#00D46A" />
    </svg>
  );
};

// TypeScript type definitions
export const LogoVariants = {
  PRIMARY: 'primary',
  ICON: 'icon',
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical'
};

export default RootUILogo;