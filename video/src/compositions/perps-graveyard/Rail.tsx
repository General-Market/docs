import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  accentCardGlow,
  BUBBLE_D,
  C,
  EASE,
  font,
  monoFont,
  RAIL_BOTTOM,
  RAIL_TOP,
  RAIL_X,
  SLIDE_STARTS,
} from "./theme";
import { PROTOCOLS } from "./data";

const N = PROTOCOLS.length;
const centreY = (i: number) => RAIL_TOP + (i / (N - 1)) * (RAIL_BOTTOM - RAIL_TOP);

const fmtM = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : `$${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;

// The right-hand progress bar: twenty logo bubbles, dim until their protocol is
// named, lit and held after. A filled track climbs behind them; a running
// "raised so far" tally ticks up. Reads the global frame — lives outside the
// per-slide Sequences, so its frame is the timeline's.
export const Rail: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let activeIdx = -1;
  for (let i = 0; i < N; i++) if (frame >= SLIDE_STARTS[i]) activeIdx = i;

  // Filled track height — eases toward the active bubble.
  const fillTo = activeIdx < 0 ? RAIL_TOP : centreY(activeIdx);
  const fillEased = (() => {
    if (activeIdx < 0) return RAIL_TOP;
    const prevY = activeIdx === 0 ? RAIL_TOP : centreY(activeIdx - 1);
    const t = interpolate(frame - SLIDE_STARTS[activeIdx], [0, 16], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE.out,
    });
    return prevY + (fillTo - prevY) * t;
  })();

  const raisedSoFar = PROTOCOLS.slice(0, activeIdx + 1).reduce((s, p) => s + (p.raised ?? 0), 0);
  const counterT = activeIdx < 0 ? 0 : interpolate(frame - SLIDE_STARTS[Math.max(0, activeIdx)], [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
  const prevRaised = PROTOCOLS.slice(0, activeIdx).reduce((s, p) => s + (p.raised ?? 0), 0);
  const shownRaised = prevRaised + (raisedSoFar - prevRaised) * counterT;

  return (
    <>
      {/* header */}
      <div
        style={{
          position: "absolute",
          left: RAIL_X - 110,
          top: 34,
          width: 220,
          textAlign: "center",
          fontFamily: monoFont,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.14em",
          color: C.faint,
        }}
      >
        {String(Math.max(0, activeIdx + 1)).padStart(2, "0")} / {N}
      </div>

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* track ground */}
        <line x1={RAIL_X} y1={RAIL_TOP} x2={RAIL_X} y2={RAIL_BOTTOM} stroke={C.rule} strokeWidth={4} strokeLinecap="round" />
        {/* filled portion — solid GM Electric with a glow */}
        <line
          x1={RAIL_X}
          y1={RAIL_TOP}
          x2={RAIL_X}
          y2={fillEased}
          stroke={C.accent}
          strokeWidth={4}
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 8px rgba(45,91,255,0.55))" }}
        />
      </svg>

      {/* bubbles */}
      {PROTOCOLS.map((p, i) => {
        const lit = frame >= SLIDE_STARTS[i];
        const isActive = i === activeIdx;
        const pop = lit
          ? spring({ fps, frame: frame - SLIDE_STARTS[i], config: { damping: 13, stiffness: 170, mass: 0.7 }, durationInFrames: 22 })
          : 0;
        const scale = (lit ? 1 : 0.84) + (isActive ? 0.16 : 0) * Math.min(1, pop) + (lit ? 0.06 * pop : 0);
        const cy = centreY(i);
        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: RAIL_X - BUBBLE_D / 2,
              top: cy - BUBBLE_D / 2,
              width: BUBBLE_D,
              height: BUBBLE_D,
              borderRadius: "50%",
              transform: `scale(${scale.toFixed(3)})`,
              overflow: "hidden",
              background: C.surface,
              border: `2px solid ${isActive ? C.accent : lit ? "rgba(45,91,255,0.55)" : C.rule}`,
              boxShadow: isActive
                ? `0 0 0 5px rgba(45,91,255,0.16), ${accentCardGlow(26, 0.34)}`
                : lit
                ? "0 4px 14px rgba(10,12,20,0.12)"
                : "none",
              filter: lit ? "none" : "grayscale(1)",
              opacity: lit ? 1 : 0.4,
            }}
          >
            <Img
              src={staticFile(`defi-flows/logos/${p.id}.jpg`)}
              alt={p.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        );
      })}

      {/* running raised tally */}
      <div
        style={{
          position: "absolute",
          left: RAIL_X - 150,
          top: RAIL_BOTTOM + 22,
          width: 300,
          textAlign: "center",
          opacity: activeIdx < 0 ? 0 : 1,
        }}
      >
        <div style={{ fontFamily: font, fontSize: 52, fontWeight: 800, letterSpacing: "-0.03em", color: C.text, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          {fmtM(shownRaised)}
        </div>
        <div style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 700, letterSpacing: "0.12em", color: C.faint, marginTop: 7 }}>
          RAISED · DEAD OR FADED
        </div>
      </div>
    </>
  );
};
