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
import { staticFile } from "remotion";

/** Data source logos — real images from public/source-imgs/ */
export const SOURCE_LOGOS: Record<string, string> = {
  steam: staticFile("source-imgs/new-steam.webp"),
  reddit: staticFile("source-imgs/new-reddit.webp"),
  polymarket: staticFile("source-imgs/new-polymarket.webp"),
  pumpfun: staticFile("source-imgs/new-pumpfun.webp"),
  tmdb: staticFile("source-imgs/new-tmdb.svg"),
  twitch: staticFile("source-imgs/new-twitch.webp"),
  db: staticFile("source-imgs/new-dbtrains.svg"),
  crypto: staticFile("source-imgs/new-coingecko.webp"),
  github: staticFile("source-imgs/new-github.webp"),
  hackernews: staticFile("source-imgs/new-hackernews.svg"),
  npm: staticFile("source-imgs/new-npm.webp"),
  finnhub: staticFile("source-imgs/new-finnhub.webp"),
  defillama: staticFile("source-imgs/new-defillama.webp"),
};

/** Helper component — renders a source logo image */
export const SourceLogo: React.FC<{source: string; size?: number}> = ({source, size = 24}) => {
  const src = SOURCE_LOGOS[source];
  if (!src) return null;
  return <img src={src} width={size} height={size} style={{borderRadius: 4, objectFit: "contain"}} />;
};
