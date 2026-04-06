export const COLOR = {
  page: "#0a0a0a",
  leftOverlay: "rgba(40, 12, 12, 0.62)",
  rightOverlay: "rgba(0, 35, 18, 0.55)",
  brand: "#00C853",
  bad: "rgba(255,100,100,0.9)",
  textPrimary: "#ffffff",
  textMuted: "rgba(255,255,255,0.5)",
  divider: "rgba(255,255,255,0.8)",
} as const;

export const FONT = {
  sans: "'Geist', 'Inter', 'Helvetica Neue', Arial, sans-serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",
} as const;

export const ANIM = {
  fast: { damping: 22, stiffness: 160, mass: 0.5 },
  medium: { damping: 18, stiffness: 100, mass: 0.6 },
  slow: { damping: 16, stiffness: 70, mass: 0.8 },
  slam: { damping: 6, stiffness: 200, mass: 0.4 },
  bounce: { damping: 10, stiffness: 120, mass: 0.5 },
} as const;
