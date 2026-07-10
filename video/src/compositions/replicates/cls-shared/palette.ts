// cls-shared — brand constants BOTH CLS explainer lanes measured to the
// same value (cls-day: "CLS Settlement in a Day"; clsnet: "CLSNet / How
// it works"). Only exact cross-lane matches live here; every near-miss
// (headline navy 12365E vs 12365B, accent red CC441E vs orange D45837,
// band greys D7D7D7 vs D9D9D9) was measured per lane and stays lane-local
// — see .claude/rounds/work/cls-shared/INVENTORY.md.
//
// Improve shared brand values HERE, then still-gate BOTH lanes at the
// affected frames (both replicas + both CRX cuts) before commit.

export const BRAND = {
  navy: "#002753", // corporate navy: card/panel bg + strokes (probed both refs)
  white: "#FDFDFD", // page white
  blue: "#4CA0D3", // light brand blue: globe/donut/map fills
  greyBand: "#D9D9D9", // grey: cls-day donut ring bg + clsnet ruler band
} as const;
