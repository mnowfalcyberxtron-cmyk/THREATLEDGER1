import React from 'react';

interface BrandMarkProps {
  className?: string;
  size?: number;
}

export function BrandMark({ className = '', size = 48 }: BrandMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 240"
      width={size}
      height={(size * 240) / 200}
      className={`shrink-0 ${className}`}
      fill="none"
      aria-label="ThreatLedger Brand Shield"
    >
      <defs>
        <linearGradient id="staticSilver" x1="20" y1="20" x2="180" y2="220" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#cbd5e1" />
          <stop offset="50%" stopColor="#f8fafc" />
          <stop offset="75%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>

        <linearGradient id="staticDark" x1="100" y1="25" x2="100" y2="215" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0b1329" />
          <stop offset="60%" stopColor="#060913" />
          <stop offset="100%" stopColor="#020408" />
        </linearGradient>

        <filter id="staticGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Shield Shadow */}
      <path
        d="M100 18 C135 18 175 26 175 26 C175 26 178 112 100 224 C22 112 25 26 25 26 C25 26 65 18 100 18 Z"
        fill="#000000"
        opacity="0.35"
        transform="translate(0, 4)"
      />

      {/* Shield Body */}
      <path
        d="M100 18 C135 18 175 26 175 26 C175 26 178 112 100 224 C22 112 25 26 25 26 C25 26 65 18 100 18 Z"
        fill="url(#staticDark)"
        stroke="url(#staticSilver)"
        strokeWidth="5"
        strokeLinejoin="round"
      />

      {/* Inner Bevel Line */}
      <path
        d="M100 27 C130 27 165 34 165 34 C165 34 167 106 100 208 C33 106 35 34 35 34 C35 34 70 27 100 27 Z"
        fill="none"
        stroke="#64748b"
        strokeWidth="1.2"
        strokeOpacity="0.4"
      />

      {/* Network Lines */}
      <g stroke="#10b981" strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round">
        <line x1="100" y1="60" x2="142" y2="82" />
        <line x1="142" y1="82" x2="152" y2="130" />
        <line x1="152" y1="130" x2="130" y2="175" />
        <line x1="130" y1="175" x2="100" y2="196" />
        <line x1="100" y1="196" x2="70" y2="175" />
        <line x1="70" y1="175" x2="48" y2="130" />
        <line x1="48" y1="130" x2="58" y2="82" />
        <line x1="58" y1="82" x2="100" y2="60" />

        <line x1="100" y1="60" x2="100" y2="118" strokeWidth="2.2" strokeOpacity="0.75" />
        <line x1="58" y1="82" x2="100" y2="118" strokeWidth="2" strokeOpacity="0.7" />
        <line x1="142" y1="82" x2="100" y2="118" strokeWidth="2" strokeOpacity="0.7" />
        <line x1="48" y1="130" x2="100" y2="118" strokeWidth="2" strokeOpacity="0.7" />
        <line x1="152" y1="130" x2="100" y2="118" strokeWidth="2" strokeOpacity="0.7" />
        <line x1="70" y1="175" x2="100" y2="118" strokeWidth="2" strokeOpacity="0.7" />
        <line x1="130" y1="175" x2="100" y2="118" strokeWidth="2" strokeOpacity="0.7" />
        <line x1="100" y1="196" x2="100" y2="118" strokeWidth="2.2" strokeOpacity="0.75" />
      </g>

      {/* Nodes */}
      <g fill="#10b981" filter="url(#staticGlow)">
        <circle cx="100" cy="60" r="5.5" fill="#34d399" />
        <circle cx="142" cy="82" r="5" fill="#34d399" />
        <circle cx="152" cy="130" r="4.5" />
        <circle cx="130" cy="175" r="4.5" />
        <circle cx="100" cy="196" r="4" fill="#059669" />
        <circle cx="70" cy="175" r="4.5" />
        <circle cx="48" cy="130" r="4.5" />
        <circle cx="58" cy="82" r="5" fill="#34d399" />
      </g>

      {/* Node Cores */}
      <g fill="#ffffff">
        <circle cx="100" cy="60" r="2" />
        <circle cx="142" cy="82" r="1.8" />
        <circle cx="152" cy="130" r="1.5" />
        <circle cx="130" cy="175" r="1.5" />
        <circle cx="100" cy="196" r="1.4" />
        <circle cx="70" cy="175" r="1.5" />
        <circle cx="48" cy="130" r="1.5" />
        <circle cx="58" cy="82" r="1.8" />
      </g>

      {/* Center Prominent Node */}
      <circle cx="100" cy="118" r="18" fill="#10b981" opacity="0.2" />
      <circle cx="100" cy="118" r="11" fill="#059669" opacity="0.4" />
      <circle cx="100" cy="118" r="8" fill="#10b981" filter="url(#staticGlow)" />
      <circle cx="100" cy="118" r="4" fill="#34d399" />
      <circle cx="100" cy="118" r="2" fill="#ffffff" />
    </svg>
  );
}
