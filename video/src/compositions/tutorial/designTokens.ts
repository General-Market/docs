/**
 * Design tokens — exact replica of frontend globals.css + SourceCard patterns.
 * Every component in the tutorial MUST use these tokens. No ad-hoc sizes.
 *
 * Video is 1920x1080. Frontend is responsive. We use the "desktop" sizes
 * scaled for video readability (1.5x multiplier on small text since
 * video is watched at smaller viewport than a desktop browser).
 */

import { font, monoFont } from "../../common/fonts";

// ── Colors (from :root CSS vars) ────────────────────────────────────────────
export const COLOR = {
  bg: "#FFFFFF",
  fg: "#1A1A1A",
  surface: "#F4F6F5",
  border: "#E0E0E0",
  borderStrong: "#000000",
  up: "#16A34A",
  down: "#DC2626",
  brand: "#00A36C",
  muted: "#999999",
  mutedLight: "#CCCCCC",
  tableHeader: "#555555",
  panelDark: "rgba(10, 10, 10, 0.85)",
  panelDarkHeavy: "rgba(10, 10, 10, 0.92)",
  sectionBar: "#000000",
  white: "#FFFFFF",
  black: "#0a0a0a",
} as const;

// ── Typography (from globals.css type utilities, scaled 1.5x for video) ─────
// Video viewers watch at ~50% of 1920px, so text needs to be ~1.5x website size

export const TYPE = {
  /** Micro labels — uppercase category badges, metric headers */
  label: {
    fontFamily: font,
    fontSize: 16, // website: 11px → video: 16px
    fontWeight: 600 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: COLOR.muted,
    lineHeight: 1.4,
  },

  /** Table headers — slightly bolder than labels */
  tableHeader: {
    fontFamily: font,
    fontSize: 16,
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.025em",
    color: COLOR.tableHeader,
    lineHeight: 1.4,
  },

  /** Stat values — big bold numbers (JetBrains Mono) */
  statValue: {
    fontFamily: monoFont,
    fontSize: 48, // website: 32px → video: 48px
    fontWeight: 900 as const,
    letterSpacing: "-0.03em",
    lineHeight: 1.15,
    fontVariantNumeric: "tabular-nums" as const,
    color: COLOR.fg,
  },

  /** Display — hero text, biggest on screen */
  display: {
    fontFamily: font,
    fontSize: 64, // website: clamp(36-56px) → video: 64px
    fontWeight: 900 as const,
    letterSpacing: "-0.035em",
    lineHeight: 1.05,
    color: COLOR.fg,
  },

  /** Heading — section titles */
  heading: {
    fontFamily: font,
    fontSize: 36,
    fontWeight: 800 as const,
    letterSpacing: "-0.025em",
    lineHeight: 1.15,
    color: COLOR.fg,
  },

  /** Subhead — card titles, source names */
  subhead: {
    fontFamily: font,
    fontSize: 24,
    fontWeight: 800 as const,
    letterSpacing: "-0.01em",
    lineHeight: 1.25,
    color: COLOR.fg,
  },

  /** Body — descriptions, paragraphs */
  body: {
    fontFamily: font,
    fontSize: 20,
    fontWeight: 400 as const,
    lineHeight: 1.5,
    color: COLOR.fg,
  },

  /** Caption — small descriptive text */
  caption: {
    fontFamily: font,
    fontSize: 16,
    fontWeight: 500 as const,
    lineHeight: 1.4,
    color: COLOR.muted,
  },

  /** Mono — code, numbers in body context */
  mono: {
    fontFamily: monoFont,
    fontSize: 20,
    fontWeight: 500 as const,
    fontVariantNumeric: "tabular-nums" as const,
    color: COLOR.fg,
  },

  /** Mono large — standalone numbers */
  monoLarge: {
    fontFamily: monoFont,
    fontSize: 36,
    fontWeight: 700 as const,
    fontVariantNumeric: "tabular-nums" as const,
    color: COLOR.fg,
  },
} as const;

// ── Panel styles ────────────────────────────────────────────────────────────

export const PANEL = {
  /** Dark overlay panel (over talking head) */
  dark: {
    background: COLOR.panelDark,
    borderRadius: 16,
    padding: "24px 32px",
  },

  /** White card (frontend style) */
  white: {
    background: COLOR.bg,
    borderRadius: 16,
    border: `1px solid ${COLOR.border}`,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    padding: "24px 32px",
  },

  /** Section bar (full-width black bar) */
  sectionBar: {
    background: COLOR.sectionBar,
    color: COLOR.white,
    padding: "16px 40px",
  },
} as const;

// ── FAQ Question styling ────────────────────────────────────────────────────

export const FAQ = {
  backdrop: COLOR.panelDarkHeavy,
  numberStyle: {
    ...TYPE.display,
    fontSize: 80,
    color: COLOR.brand,
  },
  questionStyle: {
    ...TYPE.heading,
    fontSize: 44,
    color: COLOR.white,
    textAlign: "center" as const,
    maxWidth: 900,
    lineHeight: 1.3,
  },
} as const;

// ── Node/diagram element styling ────────────────────────────────────────────

export const NODE = {
  /** Circle nodes in diagrams */
  circle: {
    radius: 52,
    strokeWidth: 2.5,
    labelSize: 14,
    labelWeight: 700 as const,
    labelFont: font,
  },
  /** Connection lines between nodes */
  connection: {
    strokeWidth: 2,
    dashArray: "8 4",
    opacity: 0.5,
  },
} as const;
