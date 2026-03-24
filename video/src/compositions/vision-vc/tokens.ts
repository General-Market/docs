// ── Vision VC Design Tokens ──────────────────────────────────────────
// Single source of truth for every visual constant in the composition.
// Import from here. Hardcode nothing.
//
// Light institutional palette — matches generalmarket.io/points.
// Geist Sans + JetBrains Mono. Borders instead of gradients.

// ── Colors ───────────────────────────────────────────────────────────

export const COLOR = {
  // Backgrounds — warm cream from visuals.html, not pure white
  page: "#F5F4EF",
  surface: "#F3F2ED",
  surfaceAlt: "#F4F3EE",
  cardBg: "#F5F4EF",

  // Decorative grid line color (SVG grids behind benefit scenes)
  gridLine: "#D5D3CC",

  // Text
  black: "#1a1a1a",
  textPrimary: "#1a1a1a",
  textSecondary: "#555555",
  textMuted: "#999999",
  textDim: "#bbbbbb",

  // Borders
  borderLight: "#e0e0e0",
  borderMedium: "#d4d4d8",

  // Accents
  brand: "#00A36C",
  brandDim: "#008f5d",

  // Data sources — desaturated variants for light mode
  dbAmber: "#d4920a",
  mcdRed: "#c42020",
  steamBlue: "#1887dd",
  twitchPurple: "#7c3aed",
  chanGreen: "#65803a",
  pumpGreen: "#16a34a",
  militaryPhosphor: "#059669",
  solarOrange: "#e07012",

  // Status
  up: "#16a34a",
  down: "#dc2626",
  warning: "#d97706",

  // Overlay
  white: "#ffffff",
  overlayLight: "rgba(255,255,255,0.85)",
} as const;

export type ColorKey = keyof typeof COLOR;

// ── Typography ───────────────────────────────────────────────────────

export const FONT = {
  sans: "'Geist', 'Inter', 'Helvetica Neue', Arial, sans-serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",
} as const;

export const TEXT = {
  heroSize: 72,
  titleSize: 56,
  headingSize: 38,
  bodySize: 28,
  captionSize: 20,
  labelSize: 14,
  badgeSize: 11,
} as const;

// ── Animation ────────────────────────────────────────────────────────
// Gentler springs. No screen shakes. Clean entrances.

export const ANIM = {
  springFast: { damping: 22, stiffness: 160, mass: 0.5 },
  springMedium: { damping: 18, stiffness: 100, mass: 0.6 },
  springSlow: { damping: 16, stiffness: 70, mass: 0.8 },
  fadeIn: 12,
  flashHold: 0,
  flashFade: 0,
} as const;

// ── Layout ───────────────────────────────────────────────────────────

export const LAYOUT = {
  width: 1920,
  height: 1080,
  padX: 80,
  padY: 60,
  counterBottom: 48,
  counterRight: 80,
  badgeTop: 32,
  badgeRight: 32,
  descBottom: 48,
  descLeft: 80,
} as const;
