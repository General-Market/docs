// A wall-mounted toggle. Click, room lights up. Click, dark. The source
// scrolljacked an image sequence; here we toggle four times across the scene
// and let the room actually go dark instead of cycling frames.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";

const TOGGLES = 4; // number of on/off flips across the scene
const CLICK_FRAMES = 12; // duration of each toggle's mechanical motion

function lightLevel(frame: number, total: number): number {
  // Equal-spaced toggle moments; between them the lamp holds at its state.
  const step = total / (TOGGLES + 1);
  let level = 0; // start dark, climb each toggle
  let progress = level;
  for (let i = 1; i <= TOGGLES; i++) {
    const at = step * i;
    if (frame > at) {
      const local = Math.min(1, (frame - at) / CLICK_FRAMES);
      const eased = Easing.bezier(0.22, 1, 0.36, 1)(local);
      progress = level === 0 ? eased : 1 - eased;
      if (frame > at + CLICK_FRAMES) {
        level = level === 0 ? 1 : 0;
        progress = level;
      }
    }
  }
  return progress;
}

function switchAngle(frame: number, total: number): number {
  // The toggle paddle tilts between -22deg (down/off) and +22deg (up/on).
  const step = total / (TOGGLES + 1);
  let on = false;
  let angle = -22;
  for (let i = 1; i <= TOGGLES; i++) {
    const at = step * i;
    if (frame > at) {
      const local = Math.min(1, (frame - at) / CLICK_FRAMES);
      const eased = Easing.bezier(0.7, 0, 0.3, 1)(local);
      const from = on ? 22 : -22;
      const to = on ? -22 : 22;
      angle = from + (to - from) * eased;
      if (frame > at + CLICK_FRAMES) {
        on = !on;
        angle = on ? 22 : -22;
      }
    }
  }
  return angle;
}

export const LightSwitch: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const lit = lightLevel(frame, durationInFrames);
  const angle = switchAngle(frame, durationInFrames);

  const wallDark = "#1a1612";
  const wallLit = "#d4b078";
  const wall = `color-mix(in oklab, ${wallDark}, ${wallLit} ${lit * 100}%)`;

  return (
    <AbsoluteFill style={{ backgroundColor: wall, overflow: "hidden" }}>
      {/* Light cone from the ceiling bulb */}
      <div
        style={{
          position: "absolute",
          top: -120,
          left: "50%",
          transform: "translateX(-50%)",
          width: 1400,
          height: 1400,
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(255, 220, 150, 0.55), rgba(255, 200, 120, 0.25) 35%, transparent 65%)",
          opacity: lit,
          filter: `blur(${30 - lit * 10}px)`,
        }}
      />

      {/* Ceiling lamp */}
      <div
        style={{
          position: "absolute",
          top: 90,
          left: "50%",
          transform: "translateX(-50%)",
          width: 60,
          height: 160,
          background: "linear-gradient(180deg, #222 0%, #111 100%)",
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 230,
          left: "50%",
          transform: "translateX(-50%)",
          width: 90,
          height: 90,
          borderRadius: "50%",
          background: `radial-gradient(circle at 40% 35%, ${
            lit > 0.5 ? "#fff8dc" : "#3a3530"
          }, ${lit > 0.5 ? "#f6c14a" : "#1c1814"})`,
          boxShadow: lit
            ? `0 0 ${60 * lit}px ${20 * lit}px rgba(255, 200, 100, ${0.8 * lit})`
            : "none",
        }}
      />

      {/* Floor shadow */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          width: 1200,
          height: 60,
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.6), transparent 70%)",
          opacity: 0.5 + lit * 0.4,
          filter: "blur(8px)",
        }}
      />

      {/* The switch plate */}
      <div
        style={{
          position: "absolute",
          right: 220,
          top: "50%",
          transform: "translateY(-50%)",
          width: 220,
          height: 340,
          borderRadius: 18,
          background: "linear-gradient(180deg, #fdfdfd 0%, #d8d8d8 100%)",
          boxShadow:
            "0 22px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.6)",
          display: "grid",
          placeItems: "center",
        }}
      >
        {/* Toggle paddle */}
        <div
          style={{
            width: 84,
            height: 180,
            borderRadius: 12,
            background: "linear-gradient(180deg, #f8f8f8 0%, #c2c2c2 100%)",
            boxShadow: "0 8px 18px rgba(0,0,0,0.35)",
            transform: `rotate(${angle}deg)`,
            transformOrigin: "50% 50%",
            transition: "background 80ms linear",
          }}
        />
      </div>

      {/* Lettering, only readable when lit */}
      <div
        style={{
          position: "absolute",
          left: 220,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#fef0c4",
          opacity: lit,
          fontFamily: "'Inter', sans-serif",
          fontSize: 84,
          fontWeight: 200,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          mixBlendMode: "screen",
        }}
      >
        on.
        <br />
        off.
        <br />
        <span style={{ opacity: 0.65 }}>on.</span>
      </div>
    </AbsoluteFill>
  );
};
