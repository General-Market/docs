import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { accentCardGlow, C, EASE, font, monoFont, PANEL_L } from "./theme";
import type { Protocol } from "./data";
import { TvlChart } from "./chart";

// Focus-pull: blur(px → 0), no opacity, no Y. For text + counting numbers. (§11)
const focusPull = (frame: number, delay: number, fromBlur = 10, dur = 14) => {
  const b = interpolate(frame - delay, [0, dur], [fromBlur, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  return `blur(${b.toFixed(2)}px)`;
};

// Wipe-on: scaleX(0 → 1) from the left, no opacity. For tracked-caps labels. (§11)
const wipeOn = (frame: number, delay: number, dur = 14) =>
  interpolate(frame - delay, [0, dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

export const Slide: React.FC<{ p: Protocol }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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

  // Drawdown number tracks the chart sweep, sharpening as it counts up.
  const ddBlur = interpolate(progress, [0.05, 0.25], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  const ddLabelWipe = interpolate(progress, [0.08, 0.28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* eyebrow */}
      <div
        style={{
          position: "absolute",
          left: PANEL_L,
          top: 96,
          fontFamily: monoFont,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.16em",
          color: C.faint,
          transform: `scaleX(${wipeOn(frame, 0).toFixed(3)})`,
          transformOrigin: "left center",
        }}
      >
        {p.model.replace(/ /g, " ")}&nbsp;·&nbsp;PERP&nbsp;DEX
      </div>

      {/* name */}
      <div
        style={{
          position: "absolute",
          left: PANEL_L,
          top: 134,
          fontFamily: font,
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: "-0.035em",
          color: C.text,
          lineHeight: 1,
          filter: focusPull(frame, 2),
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
        }}
      >
        <div
          style={{
            width: 104,
            height: 104,
            borderRadius: "50%",
            overflow: "hidden",
            background: C.surface,
            border: `1.5px solid ${C.accent}`,
            boxShadow: accentCardGlow(40, 0.22),
            flexShrink: 0,
            transform: `scale(${interpolate(frame - 8, [0, 12], [0.86, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out }).toFixed(3)})`,
          }}
        >
          <Img src={staticFile(`defi-flows/logos/${p.id}.jpg`)} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
        <div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.16em",
              color: C.faint,
              transform: `scaleX(${wipeOn(frame, 8).toFixed(3)})`,
              transformOrigin: "left center",
            }}
          >
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
              filter: focusPull(frame, 10),
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
          filter: focusPull(frame, 16),
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
        }}
      >
        <div style={{ fontFamily: font, fontSize: 132, fontWeight: 800, letterSpacing: "-0.04em", color: C.down, lineHeight: 0.9, fontVariantNumeric: "tabular-nums", filter: `blur(${ddBlur.toFixed(2)}px)` }}>
          −{ddShown}%
        </div>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: C.faint,
            marginTop: 12,
            transform: `scaleX(${ddLabelWipe.toFixed(3)})`,
            transformOrigin: "left center",
          }}
        >
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
          transform: `scaleX(${wipeOn(frame, 30).toFixed(3)})`,
          transformOrigin: "left center",
        }}
      >
        * TVL: DefiLlama — {p.name} · Funding: {p.fundSrc}
      </div>
    </div>
  );
};
