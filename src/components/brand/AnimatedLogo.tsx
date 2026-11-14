'use client';

import React from 'react';

interface AnimatedLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  subtitle?: string;
}

export function AnimatedLogo({
  className = '',
  size = 56,
  showText = false,
  subtitle = 'Centralized intelligence, evidence, assignments and historical records',
}: AnimatedLogoProps) {
  return (
    <div className={`inline-flex items-center gap-3.5 select-none ${className}`}>
      {/* Animated SVG Shield Mark */}
      <div
        className="relative shrink-0 flex items-center justify-center"
        style={{ width: size, height: (size * 240) / 200 }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 200 240"
          width="100%"
          height="100%"
          fill="none"
          className="overflow-visible"
          aria-label="ThreatLedger Animated Shield"
        >
          <style>{`
            @keyframes shieldReveal {
              0% { stroke-dashoffset: 800; opacity: 0.2; }
              100% { stroke-dashoffset: 0; opacity: 1; }
            }
            @keyframes shieldGlowPulse {
              0%, 100% { opacity: 0.15; filter: drop-shadow(0 0 2px rgba(16, 185, 129, 0.2)); }
              50% { opacity: 0.35; filter: drop-shadow(0 0 12px rgba(16, 185, 129, 0.45)); }
            }
            @keyframes centralBreathing {
              0%, 100% { transform: scale(1); opacity: 0.2; }
              50% { transform: scale(1.35); opacity: 0.45; }
            }
            @keyframes centralCoreGlow {
              0%, 100% { transform: scale(1); filter: drop-shadow(0 0 4px #10b981); }
              50% { transform: scale(1.1); filter: drop-shadow(0 0 9px #34d399); }
            }
            @keyframes nodePulseA {
              0%, 100% { transform: scale(1); opacity: 0.9; }
              50% { transform: scale(1.22); opacity: 1; filter: drop-shadow(0 0 6px #34d399); }
            }
            @keyframes nodePulseB {
              0%, 100% { transform: scale(1); opacity: 0.85; }
              50% { transform: scale(1.25); opacity: 1; filter: drop-shadow(0 0 6px #10b981); }
            }
            @keyframes nodePulseC {
              0%, 100% { transform: scale(1); opacity: 0.8; }
              50% { transform: scale(1.2); opacity: 1; filter: drop-shadow(0 0 5px #059669); }
            }
            @keyframes raySignalFlow {
              0% { stroke-dashoffset: 140; opacity: 0.3; }
              50% { opacity: 0.95; }
              100% { stroke-dashoffset: 0; opacity: 0.3; }
            }

            .shield-path {
              stroke-dasharray: 800;
              animation: shieldReveal 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .shield-ambient-glow {
              animation: shieldGlowPulse 4s ease-in-out infinite;
            }
            .central-halo {
              transform-origin: 100px 118px;
              animation: centralBreathing 3.6s ease-in-out infinite;
            }
            .central-core {
              transform-origin: 100px 118px;
              animation: centralCoreGlow 3.6s ease-in-out infinite;
            }
            .pulse-a {
              transform-box: fill-box;
              transform-origin: center;
              animation: nodePulseA 2.8s ease-in-out infinite;
            }
            .pulse-b {
              transform-box: fill-box;
              transform-origin: center;
              animation: nodePulseB 3.2s ease-in-out infinite 0.7s;
            }
            .pulse-c {
              transform-box: fill-box;
              transform-origin: center;
              animation: nodePulseC 3.5s ease-in-out infinite 1.4s;
            }
            .network-signal {
              stroke-dasharray: 8 24;
              animation: raySignalFlow 2.6s linear infinite;
            }

            @media (prefers-reduced-motion: reduce) {
              .shield-path,
              .shield-ambient-glow,
              .central-halo,
              .central-core,
              .pulse-a,
              .pulse-b,
              .pulse-c,
              .network-signal {
                animation: none !important;
                stroke-dasharray: none !important;
                stroke-dashoffset: 0 !important;
                opacity: 1 !important;
              }
            }
          `}</style>

          <defs>
            <linearGradient id="animSilverOutline" x1="20" y1="20" x2="180" y2="220" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="25%" stopColor="#cbd5e1" />
              <stop offset="50%" stopColor="#f8fafc" />
              <stop offset="75%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>

            <linearGradient id="animDarkInterior" x1="100" y1="25" x2="100" y2="215" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0b1329" />
              <stop offset="60%" stopColor="#060913" />
              <stop offset="100%" stopColor="#020408" />
            </linearGradient>

            <filter id="animMintGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="animCenterGlow" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="6.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Subtle Ambient Shield Illumination */}
          <path
            d="M100 18 C135 18 175 26 175 26 C175 26 178 112 100 224 C22 112 25 26 25 26 C25 26 65 18 100 18 Z"
            fill="#10b981"
            className="shield-ambient-glow"
          />

          {/* Shield Shadow */}
          <path
            d="M100 18 C135 18 175 26 175 26 C175 26 178 112 100 224 C22 112 25 26 25 26 C25 26 65 18 100 18 Z"
            fill="#000000"
            opacity="0.4"
            transform="translate(0, 4)"
          />

          {/* Shield Body / Interior with Stroke Reveal */}
          <path
            d="M100 18 C135 18 175 26 175 26 C175 26 178 112 100 224 C22 112 25 26 25 26 C25 26 65 18 100 18 Z"
            fill="url(#animDarkInterior)"
            stroke="url(#animSilverOutline)"
            strokeWidth="5"
            strokeLinejoin="round"
            className="shield-path"
          />

          {/* Inner Inset Silver Line */}
          <path
            d="M100 27 C130 27 165 34 165 34 C165 34 167 106 100 208 C33 106 35 34 35 34 C35 34 70 27 100 27 Z"
            fill="none"
            stroke="#64748b"
            strokeWidth="1.2"
            strokeOpacity="0.38"
          />

          {/* Static Network Base Lines */}
          <g stroke="#10b981" strokeOpacity="0.45" strokeWidth="1.8" strokeLinecap="round">
            {/* Perimeter Connections */}
            <line x1="100" y1="60" x2="142" y2="82" />
            <line x1="142" y1="82" x2="152" y2="130" />
            <line x1="152" y1="130" x2="130" y2="175" />
            <line x1="130" y1="175" x2="100" y2="196" />
            <line x1="100" y1="196" x2="70" y2="175" />
            <line x1="70" y1="175" x2="48" y2="130" />
            <line x1="48" y1="130" x2="58" y2="82" />
            <line x1="58" y1="82" x2="100" y2="60" />

            {/* Hub Radiations */}
            <line x1="100" y1="60" x2="100" y2="118" strokeWidth="2" strokeOpacity="0.75" />
            <line x1="58" y1="82" x2="100" y2="118" strokeWidth="1.8" strokeOpacity="0.65" />
            <line x1="142" y1="82" x2="100" y2="118" strokeWidth="1.8" strokeOpacity="0.65" />
            <line x1="48" y1="130" x2="100" y2="118" strokeWidth="1.8" strokeOpacity="0.65" />
            <line x1="152" y1="130" x2="100" y2="118" strokeWidth="1.8" strokeOpacity="0.65" />
            <line x1="70" y1="175" x2="100" y2="118" strokeWidth="1.8" strokeOpacity="0.65" />
            <line x1="130" y1="175" x2="100" y2="118" strokeWidth="1.8" strokeOpacity="0.65" />
            <line x1="100" y1="196" x2="100" y2="118" strokeWidth="2" strokeOpacity="0.75" />
          </g>

          {/* Dynamic Controlled Travelling Signal Highlights */}
          <g stroke="#6ee7b7" strokeWidth="2.2" strokeLinecap="round" className="network-signal">
            <line x1="100" y1="60" x2="100" y2="118" />
            <line x1="58" y1="82" x2="100" y2="118" />
            <line x1="142" y1="82" x2="100" y2="118" />
            <line x1="48" y1="130" x2="100" y2="118" />
            <line x1="152" y1="130" x2="100" y2="118" />
            <line x1="70" y1="175" x2="100" y2="118" />
            <line x1="130" y1="175" x2="100" y2="118" />
            <line x1="100" y1="196" x2="100" y2="118" />
          </g>

          {/* Staggered Pulsing Satellite Nodes */}
          <g fill="#10b981" filter="url(#animMintGlow)">
            {/* Group A (Top / High-level feeds) */}
            <circle cx="100" cy="60" r="5.5" fill="#34d399" className="pulse-a" />
            <circle cx="142" cy="82" r="5" fill="#34d399" className="pulse-a" />
            <circle cx="58" cy="82" r="5" fill="#34d399" className="pulse-a" />

            {/* Group B (Mid flanks / evidence & telemetry) */}
            <circle cx="152" cy="130" r="4.5" fill="#10b981" className="pulse-b" />
            <circle cx="48" cy="130" r="4.5" fill="#10b981" className="pulse-b" />

            {/* Group C (Lower tier / reports & verification) */}
            <circle cx="130" cy="175" r="4.5" fill="#10b981" className="pulse-c" />
            <circle cx="70" cy="175" r="4.5" fill="#10b981" className="pulse-c" />
            <circle cx="100" cy="196" r="4" fill="#059669" className="pulse-c" />
          </g>

          {/* Node Precision White Cores */}
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

          {/* Prominent Central Hub with Breathing Aura */}
          <circle cx="100" cy="118" r="22" fill="#10b981" className="central-halo" filter="url(#animCenterGlow)" />
          <circle cx="100" cy="118" r="13" fill="#059669" opacity="0.4" />
          <circle cx="100" cy="118" r="8.5" fill="#10b981" className="central-core" filter="url(#animMintGlow)" />
          <circle cx="100" cy="118" r="4.5" fill="#34d399" />
          <circle cx="100" cy="118" r="2.2" fill="#ffffff" />
        </svg>
      </div>

      {/* Editable Application Brand Typography */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center tracking-tight font-extrabold text-2xl leading-none">
            <span className="text-slate-100 font-bold">Threat</span>
            <span className="text-emerald-400 font-extrabold">Ledger</span>
          </div>
          {subtitle && (
            <span className="text-[10px] text-slate-400 tracking-wider uppercase font-medium mt-1 max-w-[260px] line-clamp-1">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
