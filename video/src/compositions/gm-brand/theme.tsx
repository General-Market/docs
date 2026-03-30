/**
 * GM Brand — Centralized Theme
 *
 * Change ANY color here and it propagates everywhere.
 * No color hex should exist outside this file.
 */

export const GM = {
  // ── Brand ──
  green:       "#00A36C",
  greenDark:   "#008A5A",
  greenLight:  "#E6F7F0",
  greenMint:   "#F0FDF4",

  // ── Accent ──
  red:         "#C40000",
  redStatus:   "#DC2626",
  greenStatus: "#16A34A",
  warning:     "#D97706",
  info:        "#2563EB",

  // ── Text ──
  textPrimary:   "#1A1A1A",
  textSecondary: "#555555",
  textMuted:     "#999999",
  textInverse:   "#FFFFFF",
  textInverseMuted: "#A1A1AA",

  // ── Surfaces (light) ──
  bgPage:      "#FFFFFF",
  bgSurface:   "#F5F5F5",
  bgCard:      "#FFFFFF",
  bgMint:      "#E6F7F0",

  // ── Surfaces (dark) ──
  bgDark:      "#0C0C0D",
  bgDarkCard:  "#18181B",
  bgDarkGreen: "#0A2E1C",

  // ── Borders ──
  borderLight:  "#E0E0E0",
  borderMedium: "#D4D4D8",
  borderDark:   "#333333",
  borderStrong: "#000000",

  // ── Gradients ──
  gradientBrand: "linear-gradient(135deg, #00A36C, #008A5A)",
  gradientGreen: "linear-gradient(135deg, #00A36C, #16A34A)",
  gradientDark:  "linear-gradient(180deg, #0C0C0D, #18181B)",

  // ── Font ──
  fontSans: "'Geist Sans', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', monospace",

  // ── Shadows ──
  shadowCard:      "0 1px 2px rgba(0,0,0,0.04)",
  shadowCardHover: "0 2px 8px rgba(0,0,0,0.06)",
  shadowModal:     "0 25px 50px rgba(0,0,0,0.20)",

  // ── Logo ──
  logoSvg: `<svg width="36" height="36" viewBox="0 0 102 102" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="102" height="102" rx="8" fill="black"/>
    <rect x="15" y="48" width="15" height="6" rx="3" fill="white"/>
    <rect x="27" y="48" width="15" height="6" rx="3" fill="white"/>
    <rect x="38" y="48" width="15" height="6" rx="3" fill="white"/>
    <rect x="49" y="48" width="15" height="6" rx="3" fill="white"/>
    <rect x="61" y="48" width="9" height="6" rx="3" fill="white"/>
    <rect x="66" y="48" width="15" height="6" rx="3" fill="white"/>
    <rect x="78" y="48" width="9" height="6" rx="3" fill="white"/>
  </svg>`,
} as const;

/** GM Logo as React component */
export const GMLogo: React.FC<{
  size?: number;
  bgColor?: string;
  barColor?: string;
}> = ({ size = 36, bgColor = "black", barColor = "white" }) => {
  const s = size / 102;
  return (
    <svg width={size} height={size} viewBox="0 0 102 102" fill="none">
      <rect width="102" height="102" rx="8" fill={bgColor}/>
      <rect x="15" y="48" width="15" height="6" rx="3" fill={barColor}/>
      <rect x="27" y="48" width="15" height="6" rx="3" fill={barColor}/>
      <rect x="38" y="48" width="15" height="6" rx="3" fill={barColor}/>
      <rect x="49" y="48" width="15" height="6" rx="3" fill={barColor}/>
      <rect x="61" y="48" width="9" height="6" rx="3" fill={barColor}/>
      <rect x="66" y="48" width="15" height="6" rx="3" fill={barColor}/>
      <rect x="78" y="48" width="9" height="6" rx="3" fill={barColor}/>
    </svg>
  );
};

import React from "react";

/** Data source logos — simple silhouette SVGs, single-color via currentColor */
export const SourceLogos = {
  steam: (size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 00-9.96 9.04l5.12 2.11a2.85 2.85 0 011.6-.49c.05 0 .1 0 .15.01l2.39-3.46v-.05a3.78 3.78 0 013.78-3.78 3.78 3.78 0 013.78 3.78 3.78 3.78 0 01-3.78 3.78h-.09l-3.4 2.43a2.86 2.86 0 01-2.84 3.08 2.86 2.86 0 01-2.82-2.41L2.2 13.39A10 10 0 1012 2z"/>
    </svg>
  ),
  reddit: (size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 13.28c.03.2.04.4.04.6 0 3.09-3.6 5.6-8.03 5.6-4.44 0-8.04-2.51-8.04-5.6 0-.2.02-.4.05-.6A1.64 1.64 0 010 12a1.65 1.65 0 011.65-1.65c.44 0 .84.18 1.13.47a9.08 9.08 0 014.96-1.58l.94-4.41a.35.35 0 01.42-.27l3.12.65a1.18 1.18 0 012.18.55 1.18 1.18 0 01-1.18 1.18 1.18 1.18 0 01-1.15-.93l-2.77-.58-.84 3.94a9.04 9.04 0 014.87 1.56c.29-.28.69-.46 1.12-.46A1.65 1.65 0 0118.09 12c0 .52-.24.98-.62 1.28zM7.5 12.5a1.25 1.25 0 000 2.5 1.25 1.25 0 000-2.5zm7 0a1.25 1.25 0 000 2.5 1.25 1.25 0 000-2.5zm-6.26 4.1a.35.35 0 01-.01-.5.35.35 0 01.5-.01c.67.67 1.97.72 2.28.72.3 0 1.6-.05 2.27-.72a.35.35 0 01.5.01.35.35 0 01-.01.5c-.93.92-2.69.96-2.76.96-.08 0-1.84-.04-2.77-.96z"/>
    </svg>
  ),
  polymarket: (size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="2" y="14" width="4" height="8" rx="1"/>
      <rect x="8" y="8" width="4" height="14" rx="1"/>
      <rect x="14" y="4" width="4" height="18" rx="1"/>
      <rect x="20" y="10" width="4" height="12" rx="1"/>
      <circle cx="4" cy="12" r="1.5"/>
      <circle cx="10" cy="6" r="1.5"/>
      <circle cx="16" cy="2" r="1.5"/>
      <circle cx="22" cy="8" r="1.5"/>
    </svg>
  ),
  pumpfun: (size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L9 9H5l5.5 5-2 8L12 18l3.5 4-2-8L19 9h-4L12 2z"/>
    </svg>
  ),
  tmdb: (size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
    </svg>
  ),
  twitch: (size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2L3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29l-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.71V3.43h11.43z"/>
    </svg>
  ),
  db: (size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 17l2-2h3l2 2 2-2h3l2 2v2H4v-2z"/>
      <rect x="3" y="14" width="18" height="2" rx="1"/>
      <path d="M12 4l-7 10h14L12 4z" opacity="0.7"/>
    </svg>
  ),
  crypto: (size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 20l4-4 3 3 4.5-5L16 16.5l4-7v10.5H2z" opacity="0.3"/>
      <path d="M2 20l4-4 3 3 4.5-5L16 16.5l4-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="20" cy="9.5" r="2"/>
    </svg>
  ),
};
