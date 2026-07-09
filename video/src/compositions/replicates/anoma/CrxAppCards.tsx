// ═══════════════════════════════════════════════════════════════
// CRX in-app mock cards for the CRX-Anoma cut. Every card is drawn
// in code from the app's own design system, hex-resolved from
// ui/frontend (globals.css + components/desk/ui.tsx): Diatype (the
// landing's brand face, replacing Inter across the whole cut), teal
// #0fb6ab, the SOFT_CARD surface, sunken wells, hairline dividers,
// brass for the lock moment, the app's own flag files. No invented
// shadows, no gradients — if app.crxfx.com doesn't render it, the
// video doesn't either. Mount windows AND the STRUCTURAL intra-scene events
// (clicks, locks, landings, chart-finishes) sit on the 82 BPM half-time
// backbeat (snare 21.95f, phase 7.24) — the slow pulse that makes the cut feel
// unhurried; values roll on the quarter-beat (10.976f) between them; charts
// finish on a snare and REST before their scene exits.
// Grid: docs/crx-anoma-beat-sync.md. Inside the cards the interface
// moves like a real one — a cursor causes things, values roll rather
// than cut, and a selection slides rather than teleports.
// ═══════════════════════════════════════════════════════════════
import React from "react";
import { AbsoluteFill } from "remotion";
import { CrxScene3Dash } from "./CrxScene3Dash";
import { CrxScene4Hedge } from "./CrxScene4Hedge";
import { CrxScene8Onboard } from "./CrxScene8Onboard";
import { CrxScene9Dealers } from "./CrxScene9Dealers";
import { CrxScene10Comply } from "./CrxScene10Comply";
import { CrxScene12App } from "./CrxScene12App";

export {
  CrxScene3Dash,
  CrxScene4Hedge,
  CrxScene8Onboard,
  CrxScene9Dealers,
  CrxScene10Comply,
  CrxScene12App,
};

// Convenience wrapper: all six scenes in reference z-order.
export const CrxAppScenes: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill>
    <CrxScene3Dash frame={frame} />
    <CrxScene4Hedge frame={frame} />
    <CrxScene8Onboard frame={frame} />
    <CrxScene9Dealers frame={frame} />
    <CrxScene10Comply frame={frame} />
    <CrxScene12App frame={frame} />
  </AbsoluteFill>
);
