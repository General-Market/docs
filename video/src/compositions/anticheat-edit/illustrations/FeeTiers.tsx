import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// MECHANISM 02 / 13 — "The fee ladder".
//
// A descending ladder of VIP tiers. VIP 0 sits at the top paying 10 bps; the
// rung walks down to VIP 9 paying 2.3 bps at the bottom. The "YOU" rung lights
// up near the top, the "MARKET MAKER" rung at the very bottom. The gap between
// any rung and the floor is shaded "theirs" — the discount you never reach.

const STAGE_W = 1280;
const STAGE_LEFT = (1920 - STAGE_W) / 2;
const STAGE_TOP = 320;

// Ten rungs, top (worst rate) → bottom (best rate). bps interpolates 10 → 2.3.
const TIERS = Array.from({ length: 10 }).map((_, i) => {
  const bps = 10 - (i / 9) * (10 - 2.3);
  return {
    tier: i,
    bps: Math.round(bps * 10) / 10,
    you: i === 0,
    mm: i === 9,
  };
});

const ROW_H = 56;
const ROW_GAP = 4;

export const FeeTiers: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const breath = 0.5 + 0.5 * Math.sin((frame / fps) * 2.2);

  // Bar scale: the widest bar (10 bps) fills the band; narrowest still reads.
  const maxBps = 10;
  const minW = 0.22;
  const fullW = STAGE_W - 360; // leave room for the tier label + bps readout

  return (
    <SceneFrame kicker="MECHANISM 02 / 13" title="The fee ladder">
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: STAGE_LEFT,
            top: STAGE_TOP,
            width: STAGE_W,
          }}
        >
          {TIERS.map((t, i) => {
            const y = i * (ROW_H + ROW_GAP);
            const local = frame - 16 - i * 2.2;
            const rise = spring({
              fps,
              frame: Math.max(0, local),
              config: { mass: 0.6, damping: 15, stiffness: 120 },
              durationInFrames: 24,
            });
            const op = interpolate(local, [0, 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            const frac = minW + (1 - minW) * (t.bps / maxBps);
            const w = fullW * frac * rise;

            const lit = t.you || t.mm;
            const barColor = lit ? scene.accent : "rgba(255,255,255,0.16)";
            const glow =
              t.you || t.mm
                ? `0 0 0 1px ${scene.accentSoft} inset, 0 10px 26px rgba(0,82,255,0.30)`
                : "none";

            return (
              <div
                key={t.tier}
                style={{
                  position: "absolute",
                  top: y,
                  left: 0,
                  width: STAGE_W,
                  height: ROW_H,
                  opacity: op,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {/* Tier label */}
                <div
                  style={{
                    width: 130,
                    fontFamily: monoFont,
                    fontSize: 19,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: lit ? scene.ink : scene.inkDim,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  VIP {t.tier}
                </div>

                {/* The rung + the shaded "theirs" remainder to the floor */}
                <div style={{ position: "relative", flex: 1, height: ROW_H }}>
                  {/* Full-width faint track = the floor (the best possible rate) */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: ROW_H / 2 - 16,
                      width: fullW,
                      height: 32,
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  />
                  {/* The bar — what this tier actually pays */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: ROW_H / 2 - 16,
                      width: w,
                      height: 32,
                      borderRadius: 16,
                      background: barColor,
                      boxShadow: glow,
                    }}
                  />
                  {/* bps readout, riding the end of the bar */}
                  <div
                    style={{
                      position: "absolute",
                      left: Math.min(w + 14, fullW + 14),
                      top: ROW_H / 2 - 14,
                      fontFamily: monoFont,
                      fontSize: 22,
                      fontWeight: 700,
                      color: lit ? scene.accentSoft : scene.inkDim,
                      fontVariantNumeric: "tabular-nums",
                      opacity: rise,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.bps.toFixed(1)} bps
                  </div>
                </div>

                {/* Identity tag for the lit rungs */}
                {lit ? (
                  <div
                    style={{
                      position: "absolute",
                      right: -4,
                      top: ROW_H / 2 - 18,
                      transform: "translateX(100%)",
                      paddingLeft: 16,
                      fontFamily: monoFont,
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: scene.ink,
                      opacity: 0.7 + 0.3 * breath,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.you ? "◀ YOU" : "◀ MARKET MAKER"}
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* Footer note — the gap that never closes */}
          <div
            style={{
              position: "absolute",
              top: TIERS.length * (ROW_H + ROW_GAP) + 26,
              left: 130,
              fontFamily: monoFont,
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: scene.inkDim,
              opacity: interpolate(frame, [40, 56], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            same trade · the rate falls 4× as you climb the tiers
          </div>

          <div
            style={{
              position: "absolute",
              top: TIERS.length * (ROW_H + ROW_GAP) + 26,
              right: 0,
              fontFamily: font,
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: scene.accentSoft,
              fontVariantNumeric: "tabular-nums",
              opacity: interpolate(frame, [44, 60], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            10 → 2.3 bps
          </div>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
