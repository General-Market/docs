import React from "react";
import { interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE, EDGE, font, monoFont, PANEL_L } from "./theme";
import type { Protocol } from "./data";
import { TvlChart } from "./chart";

const appear = (frame: number, delay: number, dur = 14) =>
  interpolate(frame - delay, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const rise = (frame: number, delay: number, dist = 16, dur = 16) =>
  interpolate(frame - delay, [0, dur], [dist, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });

export const Slide: React.FC<{ p: Protocol; dur: number }> = ({ p, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fade = interpolate(frame, [0, EDGE, dur - EDGE, dur], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Raised number — count up, stable unit so it doesn't flicker K↔M mid-count.
  const raiseSpring = spring({ fps, frame: frame - 8, config: { damping: 16, stiffness: 120, mass: 0.8 }, durationInFrames: 30 });
  const final = p.raised ?? 0;
  const unit = final >= 1e9 ? "B" : final >= 1e6 ? "M" : "K";
  const fmtStable = (n: number) =>
    unit === "B"
      ? `$${(n / 1e9).toFixed(1)}B`
      : unit === "M"
      ? `$${(n / 1e6).toFixed(final % 1e6 === 0 ? 0 : 1)}M`
      : `$${Math.round(n / 1e3)}K`;
  const raisedShown = p.raised != null ? fmtStable(final * raiseSpring) : p.raisedLabel;

  // Chart reveal + drawdown count
  const revealStart = 24;
  const revealDur = 92;
  const progress = interpolate(frame, [revealStart, revealStart + revealDur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });
  const ddShown = Math.round(p.drawdownPct * progress);

  const chartX = PANEL_L;
  const chartY = 558;
  const chartW = 1140;
  const chartH = 348;

  return (
    <div style={{ position: "absolute", inset: 0, opacity: fade }}>
      {/* eyebrow */}
      <div
        style={{
          position: "absolute",
          left: PANEL_L,
          top: 96,
          fontFamily: monoFont,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: C.faint,
          opacity: appear(frame, 0),
        }}
      >
        ORDER-BOOK&nbsp;PERP&nbsp;DEX
      </div>

      {/* name */}
      <div
        style={{
          position: "absolute",
          left: PANEL_L,
          top: 128,
          fontFamily: font,
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: "-0.035em",
          color: C.text,
          lineHeight: 1,
          opacity: appear(frame, 2),
          transform: `translateY(${rise(frame, 2).toFixed(1)}px)`,
        }}
      >
        {p.name}
      </div>

      {/* logo + raised */}
      <div
        style={{
          position: "absolute",
          left: PANEL_L,
          top: 256,
          display: "flex",
          alignItems: "center",
          gap: 30,
          opacity: appear(frame, 8),
          transform: `translateY(${rise(frame, 8, 14).toFixed(1)}px)`,
        }}
      >
        <div
          style={{
            width: 104,
            height: 104,
            borderRadius: "50%",
            overflow: "hidden",
            background: "#fff",
            border: `1px solid ${C.rule}`,
            boxShadow: "0 10px 30px rgba(10,12,20,0.16)",
            flexShrink: 0,
          }}
        >
          <img src={staticFile(`defi-flows/logos/${p.id}.jpg`)} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
        <div>
          <div style={{ fontFamily: monoFont, fontSize: 19, fontWeight: 700, letterSpacing: "0.16em", color: C.faint }}>
            {p.raised != null ? "RAISED" : "FUNDING"}
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: p.raised != null ? 120 : 78,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: C.text,
              lineHeight: 0.96,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {raisedShown}
          </div>
        </div>
      </div>

      {/* cause */}
      <div
        style={{
          position: "absolute",
          left: PANEL_L,
          top: 432,
          maxWidth: 1130,
          fontFamily: font,
          fontSize: 38,
          fontWeight: 600,
          letterSpacing: "-0.012em",
          color: C.dim,
          lineHeight: 1.22,
          opacity: appear(frame, 16),
          transform: `translateY(${rise(frame, 16, 12).toFixed(1)}px)`,
        }}
      >
        {p.cause}
      </div>

      {/* chart */}
      <TvlChart p={p} progress={progress} x={chartX} y={chartY} w={chartW} h={chartH} />

      {/* drawdown — to the right of the chart */}
      <div
        style={{
          position: "absolute",
          left: chartX + chartW + 40,
          top: chartY + 78,
          width: 320,
          opacity: interpolate(progress, [0.05, 0.25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        <div style={{ fontFamily: font, fontSize: 132, fontWeight: 800, letterSpacing: "-0.04em", color: C.down, lineHeight: 0.9, fontVariantNumeric: "tabular-nums" }}>
          −{ddShown}%
        </div>
        <div style={{ fontFamily: monoFont, fontSize: 19, fontWeight: 700, letterSpacing: "0.1em", color: C.faint, marginTop: 12 }}>
          TVL FROM PEAK
        </div>
      </div>

      {/* source cite */}
      <div
        style={{
          position: "absolute",
          left: PANEL_L,
          top: 1024,
          fontFamily: monoFont,
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: "0.01em",
          color: C.faint,
          opacity: appear(frame, 30) * 0.95,
        }}
      >
        * TVL: DefiLlama — {p.name} · Funding: {p.fundSrc}
      </div>
    </div>
  );
};
