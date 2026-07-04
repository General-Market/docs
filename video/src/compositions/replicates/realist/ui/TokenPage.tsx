import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS as C } from "./copy/token";
import { ChartArea } from "./ChartArea";
import { TokenChartChrome } from "./TokenChartChrome";
import { TokenPopup } from "./TokenPopup";
import { TokenRail } from "./TokenRail";
import { TokenBottom } from "./TokenBottom";
import { TokenTop } from "./TokenTop";

// ─────────────────────────────────────────────────────────────────────
// LIVE Axiom Pro token page (frames 418–2112) — assembly of the DOM
// chrome pieces. Full-frame 1920×1080; every child positions absolutely.
// ─────────────────────────────────────────────────────────────────────

export const TokenPage: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill style={{ background: C.navBg }}>
      <TokenChartChrome frame={frame} />
      <ChartArea frame={frame} />
      <TokenRail frame={frame} />
      <TokenBottom frame={frame} />
      <TokenTop frame={frame} />
      <TokenPopup frame={frame} />
    </AbsoluteFill>
  );
};
