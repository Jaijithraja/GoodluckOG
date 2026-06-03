"use client";

import React, { useId } from "react";

interface LogoProps {
  className?: string;
  size?: number;
}

export function GoodluckIcon({ className = "", size = 48 }: LogoProps) {
  const uniqueId = useId();
  const safeId = uniqueId.replace(/:/g, "");
  
  // Scoped IDs to prevent conflicts across multiple logo instances in the DOM
  const neonTopId = `gl-neon-top-${safeId}`;
  const limeMidId = `gl-lime-mid-${safeId}`;
  const greenShadowLId = `gl-green-shadow-l-${safeId}`;
  const emeraldBottomId = `gl-emerald-bottom-${safeId}`;
  const shadowDeepId = `gl-shadow-deep-${safeId}`;
  const innerGlowId = `gl-inner-glow-${safeId}`;
  const shadowFilterId = `gl-3d-shadow-${safeId}`;
  const glowFilterId = `gl-inner-glow-filter-${safeId}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
    >
      <defs>
        {/* Neon bright top faces */}
        <linearGradient id={neonTopId} x1="100" y1="20" x2="100" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E8FF47" />
          <stop offset="100%" stopColor="#84CC16" />
        </linearGradient>

        {/* Medium lime transitions */}
        <linearGradient id={limeMidId} x1="30" y1="60" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A3E500" />
          <stop offset="100%" stopColor="#22C55E" />
        </linearGradient>

        {/* Forest green shadow left */}
        <linearGradient id={greenShadowLId} x1="43" y1="67" x2="57" y2="125" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#15803D" />
          <stop offset="100%" stopColor="#14532D" />
        </linearGradient>

        {/* Emerald bottom faces */}
        <linearGradient id={emeraldBottomId} x1="100" y1="130" x2="100" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>

        {/* Deep shadows */}
        <linearGradient id={shadowDeepId} x1="100" y1="125" x2="156" y2="165" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#065F46" />
          <stop offset="100%" stopColor="#022C22" />
        </linearGradient>

        {/* Inner nested G glow */}
        <linearGradient id={innerGlowId} x1="74" y1="70" x2="126" y2="130" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E8FF47" />
          <stop offset="50%" stopColor="#4ADE80" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>

        {/* Drop shadow for 3D realism */}
        <filter id={shadowFilterId} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.25" />
        </filter>

        {/* Glowing filter for inner letter */}
        <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main 3D Hexagonal G Base Group */}
      <g filter={`url(#${shadowFilterId})`}>
        {/* ──────────────────────────────────────────────────────────────────
            OUTER HEXAGON FACETS (DIAMOND BEVEL SHADING)
            ────────────────────────────────────────────────────────────────── */}

        {/* Segment 1: Top-Left (Outer Face) */}
        <path
          d="M 100 20 L 100 35 L 43.71 67.5 L 30.72 60 Z"
          fill={`url(#${neonTopId})`}
        />
        {/* Segment 1: Top-Left (Inner Face) */}
        <path
          d="M 100 35 L 100 50 L 56.7 75 L 43.71 67.5 Z"
          fill={`url(#${limeMidId})`}
        />

        {/* Segment 2: Left Vertical (Outer Face) */}
        <path
          d="M 30.72 60 L 43.71 67.5 L 43.71 132.5 L 30.72 140 Z"
          fill={`url(#${limeMidId})`}
        />
        {/* Segment 2: Left Vertical (Inner Face) */}
        <path
          d="M 43.71 67.5 L 56.7 75 L 56.7 125 L 43.71 132.5 Z"
          fill={`url(#${greenShadowLId})`}
        />

        {/* Segment 3: Bottom-Left (Outer Face) */}
        <path
          d="M 30.72 140 L 43.71 132.5 L 100 165 L 100 180 Z"
          fill={`url(#${emeraldBottomId})`}
        />
        {/* Segment 3: Bottom-Left (Inner Face) */}
        <path
          d="M 43.71 132.5 L 56.7 125 L 100 150 L 100 165 Z"
          fill={`url(#${shadowDeepId})`}
        />

        {/* Segment 4: Bottom-Right (Outer Face) */}
        <path
          d="M 100 180 L 100 165 L 156.29 132.5 L 169.28 140 Z"
          fill={`url(#${emeraldBottomId})`}
        />
        {/* Segment 4: Bottom-Right (Inner Face) */}
        <path
          d="M 100 165 L 100 150 L 143.3 125 L 156.29 132.5 Z"
          fill={`url(#${shadowDeepId})`}
        />

        {/* Segment 5: Right Vertical Lower (Outer Face) */}
        <path
          d="M 169.28 140 L 156.29 132.5 L 156.29 105 L 169.28 105 Z"
          fill={`url(#${emeraldBottomId})`}
        />
        {/* Segment 5: Right Vertical Lower (Inner Face) */}
        <path
          d="M 156.29 132.5 L 143.3 125 L 143.3 105 L 156.29 105 Z"
          fill={`url(#${shadowDeepId})`}
        />

        {/* Segment 6: Right Vertical Upper (Outer Face) */}
        <path
          d="M 169.28 60 L 156.29 67.5 L 156.29 80 L 169.28 80 Z"
          fill={`url(#${neonTopId})`}
        />
        {/* Segment 6: Right Vertical Upper (Inner Face) */}
        <path
          d="M 156.29 67.5 L 143.3 75 L 143.3 80 L 156.29 80 Z"
          fill={`url(#${shadowDeepId})`}
        />

        {/* Segment 7: Top-Right (Outer Face) */}
        <path
          d="M 100 20 L 100 35 L 156.29 67.5 L 169.28 60 Z"
          fill={`url(#${neonTopId})`}
        />
        {/* Segment 7: Top-Right (Inner Face) */}
        <path
          d="M 100 35 L 100 50 L 143.3 75 L 156.29 67.5 Z"
          fill={`url(#${limeMidId})`}
        />

        {/* Segment 8: Center Horizontal G-Crossbar */}
        <path
          d="M 169.28 105 L 156.29 105 L 112 105 L 112 120 L 143.3 120 L 156.29 120 L 169.28 120 Z"
          fill={`url(#${neonTopId})`}
        />

        {/* ──────────────────────────────────────────────────────────────────
            INNER GLOWING COAXIAL NESTED "G"
            ────────────────────────────────────────────────────────────────── */}
        <path
          d="M 126 88 L 126 84 L 100 69 L 74 84 L 74 116 L 100 131 L 126 116 L 126 100 L 108 100"
          fill="none"
          stroke={`url(#${innerGlowId})`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${glowFilterId})`}
        />
      </g>
    </svg>
  );
}

interface FullLogoProps extends LogoProps {
  showTagline?: boolean;
}

export default function GoodluckLogo({ className = "", size = 32, showTagline = false }: FullLogoProps) {
  return (
    <div className={`flex items-center gap-3 antialiased ${className}`}>
      {/* 3D G-Hexagon Graphic */}
      <GoodluckIcon size={size} />

      {/* Brand Typographic Identity */}
      <div className="flex flex-col justify-center leading-none">
        <h1 className="font-display font-semibold text-white text-2xl md:text-3xl tracking-tight select-none pt-0.5">
          Goodluck
        </h1>
      </div>
    </div>
  );
}
