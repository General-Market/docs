import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// THE GENERAL MARKET ANSWER — "Everyone in one pool".
//
// A scattered grid of small labeled asset squares ("10 to 10,000 assets")
// converges into ONE central pool. Once gathered, four trader nodes around
// the pool all aim at the same centre — no private corners. The convergence
// reads first, the shared aim second.

const STAGE_W = 1500;
const STAGE_H = 560;
const STAGE_LEFT = (1920 - STAGE_W) / 2;
const STAGE_TOP = 340;

const CENTER = { x: STAGE_W / 2, y: STAGE_H / 2 - 10 };
const POOL_R = 118;

// Deterministic scatter — 28 tiles spread across the stage, each with a
// home position it springs back to the centre from.
const TILE_COUNT = 28;
const TILES = Array.from({ length: TILE_COUNT }).map((_, i) => {
  const a = (i * 2.39996); // golden-angle spiral for an even scatter
  const r = 230 + ((i * 53) % 240);
  const jx = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 40;
  const jy = ((Math.sin(i * 78.233) * 43758.5453) % 1) * 40;
  return {
    x: CENTER.x + Math.cos(a) * r + jx,
    y: CENTER.y + Math.sin(a) * r * 0.62 + jy,
    delay: 4 + (i % 7) * 1.4,
  };
});

const TRADERS = [
  { x: CENTER.x - 560, y: CENTER.y - 150 },
  { x: CENTER.x + 560, y: CENTER.y - 150 },
  { x: CENTER.x - 560, y: CENTER.y + 150 },
  { x: CENTER.x + 560, y: CENTER.y + 150 },
];

const TILE = 26;

export const BatchPool: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // The whole scatter collapses to the centre between frame ~30 and ~70.
  const collapse = interpolate(frame, [30, 72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ease = 1 - Math.pow(1 - collapse, 3);

  // Pool ring blooms in as the tiles arrive.
  const poolPop = spring({
    fps,
    frame: Math.max(0, frame - 56),
    config: { mass: 0.7, damping: 14, stiffness: 130 },
    durationInFrames: 24,
  });

  // Trader nodes + their aim lines arrive last.
  const aim = interpolate(frame, [82, 116], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const breath = 0.5 + 0.5 * Math.sin((frame / fps) * 2.2);

  return (
    <SceneFrame kicker="THE GENERAL MARKET ANSWER" title="Everyone in one pool">
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: STAGE_LEFT,
            top: STAGE_TOP,
            width: STAGE_W,
            height: STAGE_H,
          }}
        >
          {/* Aim lines: each trader → the same pool centre */}
          <svg
            width={STAGE_W}
            height={STAGE_H}
            viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
            style={{ position: "absolute", inset: 0, overflow: "visible" }}
          >
            {TRADERS.map((t, i) => {
              const ex = t.x + (CENTER.x - t.x) * aim;
              const ey = t.y + (CENTER.y - t.y) * aim;
              return (
                <line
                  key={i}
                  x1={t.x}
                  y1={t.y}
                  x2={ex}
                  y2={ey}
                  stroke={scene.accentSoft}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray="3 9"
                  opacity={0.85 * aim}
                />
              );
            })}
          </svg>

          {/* The central pool ring */}
          <div
            style={{
              position: "absolute",
              left: CENTER.x - POOL_R,
              top: CENTER.y - POOL_R,
              width: POOL_R * 2,
              height: POOL_R * 2,
              borderRadius: "50%",
              transform: `scale(${(0.4 + 0.6 * poolPop).toFixed(3)})`,
              opacity: poolPop,
              background:
                "radial-gradient(circle at 40% 35%, rgba(91,121,255,0.30) 0%, rgba(0,82,255,0.16) 55%, rgba(0,82,255,0.04) 100%)",
              border: `2px solid ${scene.accentSoft}`,
              boxShadow: `0 0 0 1px ${scene.gridLineBright} inset, 0 18px 50px rgba(0,82,255,0.34)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontFamily: font,
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: scene.ink,
                opacity: 0.85 + 0.15 * breath,
              }}
            >
              ONE POOL
            </div>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: scene.inkDim,
                marginTop: 6,
              }}
            >
              same market
            </div>
          </div>

          {/* Asset tiles: scatter → converge to the centre */}
          {TILES.map((tile, i) => {
            const local = Math.max(0, frame - tile.delay);
            const popIn = interpolate(local, [0, 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            // Position lerps from its scatter home toward the centre, but only
            // after the collapse begins. Tiles vanish into the pool as they land.
            const x = tile.x + (CENTER.x - tile.x) * ease;
            const y = tile.y + (CENTER.y - tile.y) * ease;
            const op = popIn * (1 - 0.92 * ease);
            const sc = 1 - 0.35 * ease;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x - TILE / 2,
                  top: y - TILE / 2,
                  width: TILE,
                  height: TILE,
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.10)",
                  border: `1.5px solid ${scene.accentSoft}`,
                  boxShadow: "0 6px 16px rgba(2,14,43,0.4)",
                  opacity: op,
                  transform: `scale(${sc.toFixed(3)})`,
                }}
              />
            );
          })}

          {/* Count tag riding the scatter, fades as it collapses */}
          <div
            style={{
              position: "absolute",
              left: CENTER.x - 200,
              top: -6,
              width: 400,
              textAlign: "center",
              fontFamily: monoFont,
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: scene.inkSoft,
              opacity: interpolate(frame, [10, 24, 50, 66], [0, 1, 1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            10 to 10,000 assets
          </div>

          {/* Trader nodes around the pool */}
          {TRADERS.map((t, i) => {
            const pop = spring({
              fps,
              frame: Math.max(0, frame - 84 - i * 3),
              config: { mass: 0.6, damping: 15, stiffness: 130 },
              durationInFrames: 20,
            });
            const w = 168;
            const h = 64;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: t.x - w / 2,
                  top: t.y - h / 2,
                  width: w,
                  height: h,
                  transform: `scale(${(0.6 + 0.4 * pop).toFixed(3)})`,
                  opacity: pop,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.06)",
                  border: `1.5px solid ${scene.gridLineBright}`,
                  boxShadow: "0 14px 34px rgba(2,14,43,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: monoFont,
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: scene.ink,
                }}
              >
                Trader
              </div>
            );
          })}

          {/* Footer note — the mechanism stated plainly */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: STAGE_H + 12,
              textAlign: "center",
              fontFamily: monoFont,
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: scene.inkDim,
              opacity: aim,
            }}
          >
            no private corners · the same pool for everyone
          </div>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
