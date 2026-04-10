/**
 * Design tokens — Wise design system (getdesign.md/wise).
 *
 * Lime green accent, near-black text, Inter 600 body, billboard-scale headings.
 * Ring shadows only. Pill buttons. 30-40px card radius.
 * Scale for video (1920x1080): sizes adjusted for screen readability.
 */

import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

// Load Inter with all needed weights (Wise Sans fallback = Inter at 900)
const { fontFamily: interFamily } = loadInter("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "600", "700", "800", "900"],
});

// ── Fonts ───────────────────────────────────────────────────────────────────
// Wise Sans is proprietary — we use Inter as the display fallback at weight 900.
// All text gets OpenType "calt" (contextual alternates).

export const FONT = {
  display: interFamily, // Wise Sans fallback
  body: interFamily, // Inter
  calt: '"calt" 1', // contextual alternates — enabled everywhere
} as const;

// ── Colors ──────────────────────────────────────────────────────────────────

export const COLOR = {
  // Primary Brand
  nearBlack: "#0e0f0c",
  wiseGreen: "#9fe870",
  darkGreen: "#163300",
  lightMint: "#e2f6d5",
  pastelGreen: "#cdffad",

  // Semantic
  positive: "#054d28",
  danger: "#d03238",
  warning: "#ffd11a",
  infoBg: "rgba(56,200,255,0.10)",
  brightOrange: "#ffc091",

  // Neutral
  warmDark: "#454745",
  gray: "#868685",
  lightSurface: "#e8ebe6",

  // Backgrounds
  bg: "#ffffff",
  bgDark: "#0e0f0c",

  // Derived / video-specific
  panelDark: "rgba(14, 15, 12, 0.88)",
  panelDarkHeavy: "rgba(14, 15, 12, 0.94)",
  white: "#ffffff",
  border: "rgba(14,15,12,0.12)",
  borderGreen: "#9fe870",
} as const;

// ── Typography ──────────────────────────────────────────────────────────────
// Video scale: sizes bumped ~1.3x from web for 1920x1080 readability.
// All styles include fontFeatureSettings: "calt" 1 per Wise rules.

const calt = { fontFeatureSettings: '"calt" 1' };

export const TYPE = {
  /** Display Mega — 126px on web → 100px in video. Weight 900, line-height 0.85. */
  displayMega: {
    fontFamily: FONT.display,
    fontSize: 100,
    fontWeight: 900 as const,
    lineHeight: 0.85,
    letterSpacing: "normal",
    color: COLOR.nearBlack,
    ...calt,
  },

  /** Display Hero — 96px on web → 80px in video */
  displayHero: {
    fontFamily: FONT.display,
    fontSize: 80,
    fontWeight: 900 as const,
    lineHeight: 0.85,
    letterSpacing: "normal",
    color: COLOR.nearBlack,
    ...calt,
  },

  /** Section Heading — 64px on web → 56px in video */
  sectionHeading: {
    fontFamily: FONT.display,
    fontSize: 56,
    fontWeight: 900 as const,
    lineHeight: 0.85,
    letterSpacing: "normal",
    color: COLOR.nearBlack,
    ...calt,
  },

  /** Sub-heading — 40px on web → 36px in video */
  subHeading: {
    fontFamily: FONT.display,
    fontSize: 36,
    fontWeight: 900 as const,
    lineHeight: 0.85,
    letterSpacing: "normal",
    color: COLOR.nearBlack,
    ...calt,
  },

  /** Card Title — 26px on web → 28px in video, Inter 600 */
  cardTitle: {
    fontFamily: FONT.body,
    fontSize: 28,
    fontWeight: 600 as const,
    lineHeight: 1.23,
    letterSpacing: "-0.39px",
    color: COLOR.nearBlack,
    ...calt,
  },

  /** Feature Title — 22px on web → 24px in video */
  featureTitle: {
    fontFamily: FONT.body,
    fontSize: 24,
    fontWeight: 600 as const,
    lineHeight: 1.25,
    letterSpacing: "-0.4px",
    color: COLOR.nearBlack,
    ...calt,
  },

  /** Body — 18px on web → 20px in video, Inter 400 */
  body: {
    fontFamily: FONT.body,
    fontSize: 20,
    fontWeight: 400 as const,
    lineHeight: 1.44,
    letterSpacing: "0.18px",
    color: COLOR.nearBlack,
    ...calt,
  },

  /** Body Semibold — Inter 600 (the Wise default reading weight) */
  bodySemibold: {
    fontFamily: FONT.body,
    fontSize: 20,
    fontWeight: 600 as const,
    lineHeight: 1.44,
    letterSpacing: "-0.108px",
    color: COLOR.nearBlack,
    ...calt,
  },

  /** Button — Inter 600, pill style */
  button: {
    fontFamily: FONT.body,
    fontSize: 22,
    fontWeight: 600 as const,
    lineHeight: 1.0,
    letterSpacing: "-0.108px",
    color: COLOR.darkGreen,
    ...calt,
  },

  /** Caption — 14px on web → 16px in video */
  caption: {
    fontFamily: FONT.body,
    fontSize: 16,
    fontWeight: 400 as const,
    lineHeight: 1.5,
    letterSpacing: "-0.084px",
    color: COLOR.gray,
    ...calt,
  },

  /** Caption Semibold */
  captionSemibold: {
    fontFamily: FONT.body,
    fontSize: 16,
    fontWeight: 600 as const,
    lineHeight: 1.5,
    letterSpacing: "-0.108px",
    color: COLOR.gray,
    ...calt,
  },

  /** Small — 12px on web → 14px in video */
  small: {
    fontFamily: FONT.body,
    fontSize: 14,
    fontWeight: 400 as const,
    lineHeight: 1.5,
    letterSpacing: "-0.084px",
    color: COLOR.gray,
    ...calt,
  },

  /** Label — uppercase micro text for categories, metrics headers */
  label: {
    fontFamily: FONT.body,
    fontSize: 14,
    fontWeight: 600 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    lineHeight: 1.4,
    color: COLOR.gray,
    ...calt,
  },

  /** Stat Value — big numbers (Inter 900, tabular-nums) */
  statValue: {
    fontFamily: FONT.body,
    fontSize: 48,
    fontWeight: 900 as const,
    lineHeight: 0.85,
    letterSpacing: "normal",
    fontVariantNumeric: "tabular-nums" as const,
    color: COLOR.nearBlack,
    ...calt,
  },

  // ── Dark mode variants (white text on dark bg) ──

  displayHeroDark: {
    fontFamily: FONT.display,
    fontSize: 80,
    fontWeight: 900 as const,
    lineHeight: 0.85,
    letterSpacing: "normal",
    color: COLOR.white,
    ...calt,
  },

  sectionHeadingDark: {
    fontFamily: FONT.display,
    fontSize: 56,
    fontWeight: 900 as const,
    lineHeight: 0.85,
    letterSpacing: "normal",
    color: COLOR.white,
    ...calt,
  },

  subHeadingDark: {
    fontFamily: FONT.display,
    fontSize: 36,
    fontWeight: 900 as const,
    lineHeight: 0.85,
    letterSpacing: "normal",
    color: COLOR.white,
    ...calt,
  },

  cardTitleDark: {
    fontFamily: FONT.body,
    fontSize: 28,
    fontWeight: 600 as const,
    lineHeight: 1.23,
    letterSpacing: "-0.39px",
    color: COLOR.white,
    ...calt,
  },

  bodyDark: {
    fontFamily: FONT.body,
    fontSize: 20,
    fontWeight: 400 as const,
    lineHeight: 1.44,
    letterSpacing: "0.18px",
    color: "rgba(255,255,255,0.85)",
    ...calt,
  },

  bodySemiboldDark: {
    fontFamily: FONT.body,
    fontSize: 20,
    fontWeight: 600 as const,
    lineHeight: 1.44,
    letterSpacing: "-0.108px",
    color: COLOR.white,
    ...calt,
  },

  captionDark: {
    fontFamily: FONT.body,
    fontSize: 16,
    fontWeight: 400 as const,
    lineHeight: 1.5,
    letterSpacing: "-0.084px",
    color: "rgba(255,255,255,0.55)",
    ...calt,
  },

  labelDark: {
    fontFamily: FONT.body,
    fontSize: 14,
    fontWeight: 600 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    lineHeight: 1.4,
    color: "rgba(255,255,255,0.55)",
    ...calt,
  },

  statValueDark: {
    fontFamily: FONT.body,
    fontSize: 48,
    fontWeight: 900 as const,
    lineHeight: 0.85,
    letterSpacing: "normal",
    fontVariantNumeric: "tabular-nums" as const,
    color: COLOR.white,
    ...calt,
  },
} as const;

// ── Panels & Cards ──────────────────────────────────────────────────────────

export const PANEL = {
  /** White card — 30px radius, ring shadow */
  white: {
    background: COLOR.bg,
    borderRadius: 30,
    border: `1px solid ${COLOR.border}`,
    boxShadow: "rgba(14,15,12,0.12) 0px 0px 0px 1px",
    padding: "32px 40px",
  },

  /** Large white card — 40px radius (tables, feature cards) */
  whiteLarge: {
    background: COLOR.bg,
    borderRadius: 40,
    border: `1px solid ${COLOR.border}`,
    boxShadow: "rgba(14,15,12,0.12) 0px 0px 0px 1px",
    padding: "40px 48px",
  },

  /** Dark panel */
  dark: {
    background: COLOR.panelDark,
    borderRadius: 30,
    border: "1px solid rgba(255,255,255,0.06)",
    padding: "32px 40px",
  },

  /** Green accent card */
  greenAccent: {
    background: COLOR.lightMint,
    borderRadius: 30,
    border: `1px solid ${COLOR.wiseGreen}`,
    padding: "32px 40px",
  },
} as const;

// ── Buttons ─────────────────────────────────────────────────────────────────

export const BUTTON = {
  /** Primary green pill */
  primary: {
    background: COLOR.wiseGreen,
    color: COLOR.darkGreen,
    borderRadius: 9999,
    padding: "8px 24px",
    fontFamily: FONT.body,
    fontSize: 20,
    fontWeight: 600 as const,
    lineHeight: 1.0,
    letterSpacing: "-0.108px",
    border: "none",
    cursor: "pointer",
    ...calt,
  },

  /** Secondary subtle pill */
  secondary: {
    background: "rgba(22, 51, 0, 0.08)",
    color: COLOR.nearBlack,
    borderRadius: 9999,
    padding: "8px 20px",
    fontFamily: FONT.body,
    fontSize: 20,
    fontWeight: 600 as const,
    lineHeight: 1.0,
    letterSpacing: "-0.108px",
    border: "none",
    ...calt,
  },
} as const;

// ── Node/diagram elements ───────────────────────────────────────────────────

export const NODE = {
  circle: {
    radius: 52,
    strokeWidth: 2,
    labelSize: 14,
    labelWeight: 600 as const,
    labelFont: FONT.body,
  },
  connection: {
    strokeWidth: 2,
    dashArray: "8 4",
    opacity: 0.4,
  },
} as const;

// ── FAQ Question styling ────────────────────────────────────────────────────

export const FAQ = {
  backdrop: COLOR.panelDarkHeavy,
  numberStyle: {
    ...TYPE.displayHero,
    fontSize: 100,
    color: COLOR.wiseGreen,
  },
  questionStyle: {
    ...TYPE.sectionHeading,
    fontSize: 44,
    fontWeight: 700 as const,
    color: COLOR.white,
    textAlign: "center" as const,
    maxWidth: 1000,
    lineHeight: 1.15,
  },
} as const;

// ── Spacing ─────────────────────────────────────────────────────────────────
// Base unit: 8px (Wise spacing system)

export const SPACE = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
