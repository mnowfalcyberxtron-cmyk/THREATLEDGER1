'use client';

import React from 'react';
import Link from 'next/link';
import { AnimatedLogo } from './AnimatedLogo';

interface BrandHeaderProps {
  size?: number;
  showSubtitle?: boolean;
  href?: string;
  className?: string;
}

export function BrandHeader({
  size = 38,
  showSubtitle = false,
  href = '/dashboard',
  className = '',
}: BrandHeaderProps) {
  const content = (
    <div className={`flex items-center gap-3 ${className}`}>
      <AnimatedLogo
        size={size}
        showText={true}
        subtitle={showSubtitle ? 'Centralized intelligence, evidence, assignments and historical records' : undefined}
      />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-95 transition-opacity inline-flex">
        {content}
      </Link>
    );
  }

  return content;
}
