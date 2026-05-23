import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, monoFont, scene } from "../props";

// Colocation — the market maker bolts a server to the same rack as the
// matching engine; you sit a continent away. A signal pulse leaves the
// engine: it reaches the MM in ~0.5 m of cable, and reaches you after a
// long dashed haul. The distance IS the edge.
//
// Layout: matching-engine rack centre-left, MM rack hard against it (a
// short fat cable), a long dashed line running off to a small distant
// "YOU" node on the right. Two pulses ride the wires, the near one
// arriving long before the far one.

const ENGINE_X = 470;
const MM_X = 720;
const YOU_X = 1560;
const RACK_Y = 540;
const RACK_W = 168;
const RACK_H = 300;

// A simple rack glyph: a tall card with stacked server units.
const Rack: React.FC<{
  label: string;
  sub: string;
  units: number;
  active: boolean;
  delay: number;
}> = ({ label, sub, units, active, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { mass: 0.6, damping: 15, stiffness: 120 },
    durationInFrames: 22,
  });
  const op = interpolate(frame - delay, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "relative",
        width: RACK_W,
        height: RACK_H,
        borderRadius: 20,
        background: active
          ? "rgba(91,121,255,0.22)"
          : "rgba(255,255,255,0.06)",
        border: `1.5px solid ${active ? scene.accentSoft : "rgba(255,255,255,0.30)"}`,
        boxShadow: active
          ? `0 0 0 1px ${scene.accentSoft} inset, 0 18px 48px rgba(0,82,255,0.30)`
          : "0 18px 44px rgba(2,14,43,0.40)",
        transform: `scale(${interpolate(pop, [0, 1], [0.7, 1]).toFixed(3)})`,
        opacity: op,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 9,
      }}
    >
      {Array.from({ length: units }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            borderRadius: 6,
            background: active ? "rgba(91,121,255,0.30)" : "rgba(255,255,255,0.10)",
            border: `1px solid ${active ? "rgba(91,121,255,0.55)" : "rgba(255,255,255,0.16)"}`,
            display: "flex",
            alignItems: "center",
            paddingLeft: 10,
            gap: 6,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: active ? scene.accentSoft : scene.inkDim,
              boxShadow: active ? `0 0 8px ${scene.accentSoft}` : "none",
            }}
          />
          <div
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: "rgba(255,255,255,0.14)",
            }}
          />
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          top: -64,
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: active ? scene.accentSoft : scene.ink,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: scene.inkDim,
            marginTop: 3,
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
};

export const Colocation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pulse cycle: a packet leaves the engine and travels both wires.
  const CYCLE = 78;
  const tp = (frame % CYCLE) / CYCLE; // 0..1

  // Near pulse: engine → MM, short hop, completes in the first ~12% of cycle.
  const nearP = Math.min(1, tp / 0.12);
  const nearX = interpolate(nearP, [0, 1], [ENGINE_X + RACK_W / 2, MM_X - RACK_W / 2]);
  const nearLive = tp < 0.16;

  // Far pulse: engine → YOU, the long haul, the whole cycle.
  const farP = tp;
  const farX = interpolate(farP, [0.05, 0.96], [ENGINE_X + RACK_W / 2, YOU_X], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const farLive = tp > 0.05;

  const wireOp = interpolate(frame, [10, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // YOU node entrance.
  const youPop = spring({
    fps,
    frame: Math.max(0, frame - 24),
    config: { mass: 0.6, damping: 15, stiffness: 120 },
    durationInFrames: 22,
  });

  return (
    <SceneFrame kicker="MECHANISM 01 / 13" title="Colocation">
      <AbsoluteFill>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1920 1080"
          style={{ position: "absolute", inset: 0 }}
        >
          {/* short fat cable: engine → MM (~0.5 m) */}
          <line
            x1={ENGINE_X + RACK_W / 2}
            y1={RACK_Y}
            x2={MM_X - RACK_W / 2}
            y2={RACK_Y}
            stroke={scene.accentSoft}
            strokeWidth={6}
            strokeLinecap="round"
            opacity={wireOp}
          />
          {/* long dashed haul: engine → YOU */}
          <line
            x1={ENGINE_X + RACK_W / 2}
            y1={RACK_Y}
            x2={YOU_X}
            y2={RACK_Y}
            stroke="rgba(255,255,255,0.34)"
            strokeWidth={2.5}
            strokeDasharray="14 12"
            opacity={wireOp}
          />
          {/* near pulse */}
          {nearLive ? (
            <circle cx={nearX} cy={RACK_Y} r={9} fill={scene.ink}>
            </circle>
          ) : null}
          {nearLive ? (
            <circle cx={nearX} cy={RACK_Y} r={18} fill="none" stroke={scene.accentSoft} strokeWidth={2} opacity={0.6} />
          ) : null}
          {/* far pulse */}
          {farLive ? (
            <circle cx={farX} cy={RACK_Y} r={7} fill={scene.inkSoft} opacity={0.9} />
          ) : null}
        </svg>

        {/* distance bracket label over the long wire */}
        <div
          style={{
            position: "absolute",
            left: MM_X + 60,
            right: 1920 - YOU_X,
            top: RACK_Y - 70,
            textAlign: "center",
            fontFamily: monoFont,
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: scene.inkDim,
            opacity: wireOp,
          }}
        >
          ~1,200 km · light + routing
        </div>

        {/* near cable label */}
        <div
          style={{
            position: "absolute",
            left: ENGINE_X + RACK_W / 2,
            width: MM_X - RACK_W / 2 - (ENGINE_X + RACK_W / 2),
            top: RACK_Y - 50,
            textAlign: "center",
            fontFamily: monoFont,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: scene.accentSoft,
            opacity: wireOp,
          }}
        >
          ~0.5 m
        </div>

        {/* matching engine rack */}
        <div style={{ position: "absolute", left: ENGINE_X, top: RACK_Y - RACK_H / 2 }}>
          <Rack label="Matching" sub="Engine" units={5} active={false} delay={6} />
        </div>

        {/* market maker rack — bolted to the engine */}
        <div style={{ position: "absolute", left: MM_X, top: RACK_Y - RACK_H / 2 }}>
          <Rack label="Market Maker" sub="Same rack" units={5} active delay={12} />
        </div>

        {/* YOU — a small distant node */}
        <div
          style={{
            position: "absolute",
            left: YOU_X,
            top: RACK_Y,
            transform: `translate(-50%, -50%) scale(${interpolate(youPop, [0, 1], [0.6, 1]).toFixed(3)})`,
            opacity: interpolate(frame - 24, [0, 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 16,
              background: "rgba(255,255,255,0.07)",
              border: "1.5px solid rgba(255,255,255,0.32)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke={scene.inkSoft} strokeWidth="1.8" />
              <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke={scene.inkSoft} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div
            style={{
              position: "absolute",
              top: 104,
              left: "50%",
              transform: "translateX(-50%)",
              fontFamily: monoFont,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: scene.ink,
            }}
          >
            YOU
          </div>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
