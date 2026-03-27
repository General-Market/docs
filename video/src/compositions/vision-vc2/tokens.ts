// ── Vision VC2 Design Tokens ─────────────────────────────────────────
// Reuses the institutional palette from VisionVC.

export const COLOR = {
  page: "#F5F4EF",
  textPrimary: "#1a1a1a",
  textSecondary: "#555555",
  textMuted: "#999999",
} as const;

export const FONT = {
  sans: "'Geist', 'Inter', 'Helvetica Neue', Arial, sans-serif",
} as const;

export const ANIM = {
  springFast: { damping: 22, stiffness: 160, mass: 0.5 },
  springMedium: { damping: 18, stiffness: 100, mass: 0.6 },
  springSlow: { damping: 16, stiffness: 70, mass: 0.8 },
  springSlam: { damping: 6, stiffness: 200, mass: 0.4 },
  springRing: { damping: 8, stiffness: 80, mass: 0.6 },
} as const;
