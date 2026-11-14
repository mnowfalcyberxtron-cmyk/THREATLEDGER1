'use client';

import React from 'react';
import Image from 'next/image';

export type LogoVariant = 'login' | 'sidebar' | 'header' | 'loading' | 'email' | 'badge' | 'custom';

interface ThreatLedgerLogoProps {
  variant?: LogoVariant;
  animated?: boolean;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

const VARIANT_DIMENSIONS: Record<LogoVariant, { width: number; height: number }> = {
  login: { width: 88, height: 98 },
  loading: { width: 64, height: 72 },
  sidebar: { width: 36, height: 40 },
  header: { width: 32, height: 36 },
  badge: { width: 24, height: 27 },
  email: { width: 48, height: 54 },
  custom: { width: 40, height: 45 },
};

export function ThreatLedgerLogo({
  variant = 'sidebar',
  animated = false,
  className = '',
  width,
  height,
  priority = false,
}: ThreatLedgerLogoProps) {
  const dimensions = VARIANT_DIMENSIONS[variant];
  const finalWidth = width || dimensions.width;
  const finalHeight = height || dimensions.height;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${
        animated ? 'threatledger-logo-animated' : ''
      } ${className}`}
      style={{ width: finalWidth, height: finalHeight }}
    >
      {/* Subtle Mint Glow Aura (Active when animated and not reduced motion) */}
      {animated && (
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-emerald-500/20 blur-md pointer-events-none threatledger-aura-pulse"
        />
      )}

      {/* Official ThreatLedger Logo Artwork (Single source of truth) */}
      <Image
        src="/brand/threatledger-logo.png"
        alt="ThreatLedger logo"
        width={finalWidth}
        height={finalHeight}
        priority={priority || variant === 'login' || variant === 'sidebar'}
        className="relative z-10 object-contain select-none"
      />

      <style jsx>{`
        .threatledger-aura-pulse {
          animation: tl-aura 3.5s ease-in-out infinite;
        }

        @keyframes tl-aura {
          0%, 100% {
            opacity: 0.25;
            transform: scale(0.92);
          }
          50% {
            opacity: 0.65;
            transform: scale(1.08);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .threatledger-aura-pulse {
            animation: none !important;
            opacity: 0.3 !important;
          }
        }
      `}</style>
    </div>
  );
}
