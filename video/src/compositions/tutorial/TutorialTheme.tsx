/**
 * TutorialTheme — switchable color scheme for the Tutorial composition.
 *
 * Two entry points:
 *   useTheme()        — raw semantic tokens (bg, text, accent, ...)
 *   useDesignTokens() — returns theme-resolved COLOR, TYPE, PANEL objects
 *                        with the same shape as designTokens.ts exports.
 *                        Overlays swap their import, code stays identical.
 *
 * Usage:
 *   <TutorialThemeProvider theme={nightTheme}>
 *     <TutorialVideo />
 *   </TutorialThemeProvider>
 */

import React from "react";
import { COLOR, TYPE, PANEL, BUTTON, FAQ } from "./designTokens";

// ── Theme shape ────────────────────────────────────────────────────────────

export interface TutorialTheme {
  bg: string;
  text: string;
  textMuted: string;
  accent: string;
  accentDark: string;
  accentLight: string;
  border: string;
  shadow: string;
  panelBg: string;
}

// ── Presets ─────────────────────────────────────────────────────────────────

export const dayTheme: TutorialTheme = {
  bg: COLOR.bg,
  text: COLOR.nearBlack,
  textMuted: COLOR.gray,
  accent: COLOR.wiseGreen,
  accentDark: COLOR.darkGreen,
  accentLight: COLOR.lightMint,
  border: COLOR.border,
  shadow: "0 4px 24px rgba(0,0,0,0.08)",
  panelBg: COLOR.bg,
};

export const nightTheme: TutorialTheme = {
  bg: "#0e0f0c",
  text: "#f0f0ec",
  textMuted: "rgba(255,255,255,0.55)",
  accent: COLOR.wiseGreen,
  accentDark: COLOR.darkGreen,
  accentLight: "rgba(159,232,112,0.12)",
  border: "rgba(255,255,255,0.08)",
  shadow: "0 4px 24px rgba(0,0,0,0.4)",
  panelBg: "rgba(255,255,255,0.04)",
};

// ── Context ─────────────────────────────────────────────────────────────────

const ThemeContext = React.createContext<TutorialTheme>(dayTheme);

export const TutorialThemeProvider: React.FC<{
  theme: TutorialTheme;
  children: React.ReactNode;
}> = ({ theme, children }) => (
  <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
);

export function useTheme(): TutorialTheme {
  return React.useContext(ThemeContext);
}

// ── Hex → RGB (for per-channel interpolation in overlays) ──────────────────

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// ── Theme-resolved design tokens ───────────────────────────────────────────
// Same shape as the designTokens.ts exports, with theme colors injected.
// Overlays call useDesignTokens() instead of importing from designTokens.

export function useDesignTokens() {
  const t = useTheme();

  const C = {
    ...COLOR,
    nearBlack: t.text,
    bg: t.bg,
    wiseGreen: t.accent,
    darkGreen: t.accentDark,
    lightMint: t.accentLight,
    pastelGreen: t.accentLight,
    gray: t.textMuted,
    border: t.border,
    lightSurface: t.border,
    panelBg: t.panelBg,
  } as typeof COLOR & { panelBg: string };

  const T = {
    ...TYPE,
    displayMega: { ...TYPE.displayMega, color: t.text },
    displayHero: { ...TYPE.displayHero, color: t.text },
    sectionHeading: { ...TYPE.sectionHeading, color: t.text },
    subHeading: { ...TYPE.subHeading, color: t.text },
    cardTitle: { ...TYPE.cardTitle, color: t.text },
    featureTitle: { ...TYPE.featureTitle, color: t.text },
    body: { ...TYPE.body, color: t.text },
    bodySemibold: { ...TYPE.bodySemibold, color: t.text },
    button: { ...TYPE.button, color: t.accentDark },
    caption: { ...TYPE.caption, color: t.textMuted },
    captionSemibold: { ...TYPE.captionSemibold, color: t.textMuted },
    small: { ...TYPE.small, color: t.textMuted },
    label: { ...TYPE.label, color: t.textMuted },
    statValue: { ...TYPE.statValue, color: t.text },
  };

  const P = {
    ...PANEL,
    white: {
      ...PANEL.white,
      background: t.panelBg,
      border: `1px solid ${t.border}`,
      boxShadow: t.shadow,
    },
    whiteLarge: {
      ...PANEL.whiteLarge,
      background: t.panelBg,
      border: `1px solid ${t.border}`,
      boxShadow: t.shadow,
    },
    greenAccent: {
      ...PANEL.greenAccent,
      background: t.accentLight,
      border: `1px solid ${t.accent}`,
    },
  };

  const B = {
    ...BUTTON,
    primary: { ...BUTTON.primary, background: t.accent, color: t.accentDark },
    secondary: { ...BUTTON.secondary, color: t.text },
  };

  const F = {
    ...FAQ,
    backdrop: COLOR.panelDarkHeavy,
    numberStyle: { ...FAQ.numberStyle, color: t.accent },
    questionStyle: { ...FAQ.questionStyle, color: COLOR.white },
  };

  return { COLOR: C, TYPE: T, PANEL: P, BUTTON: B, FAQ: F };
}
