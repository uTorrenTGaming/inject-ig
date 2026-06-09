import React from 'react';

export default function IGIcon({ className = "w-6 h-6", size = 24, ...props }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className} 
      {...props}
    >
      {/* Background Box with soft opacity */}
      <rect width="100" height="100" rx="24" fill="currentColor" fillOpacity="0.1" />
      {/* IG Lettering */}
      <text 
        x="50" 
        y="68" 
        fontSize="52" 
        fontWeight="800" 
        fontFamily="sans-serif" 
        fill="currentColor" 
        textAnchor="middle" 
        letterSpacing="-3"
      >
        IG
      </text>
    </svg>
  );
}
