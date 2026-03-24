import React from "react";
import {
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from "remotion";
import { noise2D } from "@remotion/noise";

const CHIBI_SRC = "test-chibi/chibi.png";
const SIZE = 180;
const COLS = 4;
const ROWS = 3;
const CELL_W = 1920 / COLS; // 480
const CELL_H = 1080 / ROWS; // 360

// --- Bezier helper ---
const cubicBezier = (x1: number, y1: number, x2: number, y2: number) => {
  return (x: number): number => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const cx =
        3 * x1 * t * (1 - t) * (1 - t) +
        3 * x2 * t * t * (1 - t) +
        t * t * t -
        x;
      const dx =
        3 * x1 * (1 - t) * (1 - t) -
        6 * x1 * t * (1 - t) +
        6 * x2 * t * (1 - t) -
        3 * x2 * t * t +
        3 * t * t;
      if (Math.abs(dx) < 1e-6) break;
      t -= cx / dx;
    }
    t = Math.max(0, Math.min(1, t));
    return (
      3 * y1 * t * (1 - t) * (1 - t) +
      3 * y2 * t * t * (1 - t) +
      t * t * t
    );
  };
};
const rampUp = cubicBezier(0.12, 0.8, 0.3, 1.0);
const rampDown = cubicBezier(0.5, 0.0, 0.7, 0.2);
const pulse = (frame: number, start: number, dur: number): number => {
  if (frame < start || frame >= start + dur) return 0;
  const t = (frame - start) / dur;
  if (t < 0.25) return rampUp(t / 0.25);
  return 1 - rampDown((t - 0.25) / 0.75);
};
const loopPulse = (frame: number, cycle: number, dur: number): number => {
  return pulse(frame % cycle, 0, dur);
};

// --- Cell ---
const Cell: React.FC<{
  label: string;
  row: number;
  col: number;
  children: React.ReactNode;
}> = ({ label, row, col, children }) => (
  <div
    style={{
      position: "absolute",
      left: col * CELL_W,
      top: row * CELL_H,
      width: CELL_W,
      height: CELL_H,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      borderRight: "1px solid rgba(255,255,255,0.05)",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}
  >
    <div
      style={{
        color: "white",
        fontFamily: "IBM Plex Sans, sans-serif",
        fontSize: 18,
        fontWeight: 700,
        marginBottom: 10,
        textTransform: "uppercase",
        letterSpacing: 2,
        opacity: 0.85,
      }}
    >
      {label}
    </div>
    <div
      style={{
        width: SIZE,
        height: SIZE,
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  </div>
);

const ChibiImg: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <Img
    src={staticFile(CHIBI_SRC)}
    style={{ width: SIZE, height: "auto", objectFit: "contain", ...style }}
  />
);

// ============ 12 ANIMATION TECHNIQUES ============

// 1. Squash & Stretch — compress X, extend Y on hit
const SquashStretch: React.FC = () => {
  const frame = useCurrentFrame();
  const p = loopPulse(frame, 22, 9);
  return (
    <div
      style={{
        transform: `scaleX(${1 - p * 0.09}) scaleY(${1 + p * 0.11})`,
        transformOrigin: "center bottom",
      }}
    >
      <ChibiImg />
    </div>
  );
};

// 2. Head Tilt — alternating rotation on emphasis
const HeadTilt: React.FC = () => {
  const frame = useCurrentFrame();
  const p1 = loopPulse(frame, 28, 9);
  const p2 = loopPulse((frame + 14) % 28, 28, 9);
  return (
    <div
      style={{
        transform: `rotate(${p1 * 4.5 - p2 * 3.5}deg)`,
        transformOrigin: "center bottom",
      }}
    >
      <ChibiImg />
    </div>
  );
};

// 3. Anticipation Dip — shrink before punch
const AnticipationDip: React.FC = () => {
  const frame = useCurrentFrame();
  const f = frame % 28;
  let s = 1;
  if (f < 4) s = 1 - 0.04 * rampUp(f / 4);
  else if (f < 13) s = 1 + pulse(f, 4, 9) * 0.09;
  return (
    <div style={{ transform: `scale(${s})`, transformOrigin: "center bottom" }}>
      <ChibiImg />
    </div>
  );
};

// 4. Shake — rapid lateral noise burst
const ShakeVibrate: React.FC = () => {
  const frame = useCurrentFrame();
  const f = frame % 30;
  let dx = 0,
    dy = 0;
  if (f >= 3 && f < 11) {
    const i = 1 - (f - 3) / 8;
    dx = noise2D("sx", frame * 0.6, 0) * 6 * i;
    dy = noise2D("sy", 0, frame * 0.6) * 4 * i;
  }
  return (
    <div style={{ transform: `translate(${dx}px, ${dy}px)` }}>
      <ChibiImg />
    </div>
  );
};

// 5. Eye-line Drift — slow lateral sway, looking around
const EyeLineDrift: React.FC = () => {
  const frame = useCurrentFrame();
  const dx = Math.sin((frame / 36) * Math.PI * 2) * 14;
  const tilt = Math.sin((frame / 36) * Math.PI * 2) * -1.8;
  return (
    <div
      style={{
        transform: `translateX(${dx}px) rotate(${tilt}deg)`,
        transformOrigin: "center bottom",
      }}
    >
      <ChibiImg />
    </div>
  );
};

// 6. Bounce Settle — spring overshoot landing
const BounceSettle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame % 32,
    fps,
    config: { damping: 7, stiffness: 280, mass: 0.6 },
    durationInFrames: 20,
  });
  return (
    <div
      style={{
        transform: `scale(${0.82 + s * 0.18})`,
        transformOrigin: "center bottom",
      }}
    >
      <ChibiImg />
    </div>
  );
};

// 7. Shadow Pulse — shadow depth synced to zoom
const ShadowPulse: React.FC = () => {
  const frame = useCurrentFrame();
  const p = loopPulse(frame, 22, 9);
  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "absolute",
          bottom: -6,
          left: "50%",
          width: SIZE * 0.5,
          height: 12,
          borderRadius: "50%",
          background: `rgba(0,0,0,${0.25 - p * 0.1})`,
          transform: `translateX(-50%) scaleX(${1 + p * 0.18})`,
          filter: "blur(5px)",
        }}
      />
      <div style={{ transform: `scale(${1 + p * 0.07})`, transformOrigin: "center bottom" }}>
        <ChibiImg />
      </div>
    </div>
  );
};

// 8. Blink — quick double-blink opacity
const OpacityBlink: React.FC = () => {
  const frame = useCurrentFrame();
  const f = frame % 28;
  let opacity = 1;
  if ((f >= 5 && f < 8) || (f >= 10 && f < 13)) {
    const bt = f >= 10 ? (f - 10) / 3 : (f - 5) / 3;
    opacity = 1 - 0.35 * Math.sin(bt * Math.PI);
  }
  return (
    <div style={{ opacity }}>
      <ChibiImg />
    </div>
  );
};

// 9. Nod — translateY dip like nodding agreement
const Nod: React.FC = () => {
  const frame = useCurrentFrame();
  const p1 = loopPulse(frame, 26, 8);
  const p2 = loopPulse((frame + 13) % 26, 26, 8);
  const dy = (p1 + p2 * 0.7) * 10;
  const sx = 1 + (p1 + p2 * 0.7) * 0.015;
  return (
    <div
      style={{
        transform: `translateY(${dy}px) scaleX(${sx})`,
        transformOrigin: "center bottom",
      }}
    >
      <ChibiImg />
    </div>
  );
};

// 10. Wobble / Jelly — wobbly deformation side to side
const Wobble: React.FC = () => {
  const frame = useCurrentFrame();
  const w = Math.sin((frame / 8) * Math.PI * 2);
  const skewX = w * 3;
  const scaleX = 1 + w * 0.03;
  return (
    <div
      style={{
        transform: `skewX(${skewX}deg) scaleX(${scaleX})`,
        transformOrigin: "center bottom",
      }}
    >
      <ChibiImg />
    </div>
  );
};

// 11. Heartbeat — double-pulse ba-bump rhythm
const Heartbeat: React.FC = () => {
  const frame = useCurrentFrame();
  const cycle = 30;
  const f = frame % cycle;
  const p1 = pulse(f, 0, 7);
  const p2 = pulse(f, 8, 6);
  const s = 1 + p1 * 0.08 + p2 * 0.05;
  return (
    <div style={{ transform: `scale(${s})`, transformOrigin: "center bottom" }}>
      <ChibiImg />
    </div>
  );
};

// 12. Float / Hover — gentle levitation bob
const FloatHover: React.FC = () => {
  const frame = useCurrentFrame();
  const dy = Math.sin((frame / 28) * Math.PI * 2) * -10;
  const rot = Math.sin((frame / 40) * Math.PI * 2) * 1.5;
  return (
    <div
      style={{
        transform: `translateY(${dy}px) rotate(${rot}deg)`,
        transformOrigin: "center center",
      }}
    >
      <ChibiImg />
    </div>
  );
};

// ============ SHOWCASE GRID (1920×1080, 4×3) ============

export const ShowcaseAnimations: React.FC = () => {
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        backgroundColor: "#0f2847",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Row 0 */}
      <Cell label="Squash & Stretch" row={0} col={0}>
        <SquashStretch />
      </Cell>
      <Cell label="Head Tilt" row={0} col={1}>
        <HeadTilt />
      </Cell>
      <Cell label="Anticipation Dip" row={0} col={2}>
        <AnticipationDip />
      </Cell>
      <Cell label="Shake" row={0} col={3}>
        <ShakeVibrate />
      </Cell>

      {/* Row 1 */}
      <Cell label="Eye-line Drift" row={1} col={0}>
        <EyeLineDrift />
      </Cell>
      <Cell label="Bounce Settle" row={1} col={1}>
        <BounceSettle />
      </Cell>
      <Cell label="Shadow Pulse" row={1} col={2}>
        <ShadowPulse />
      </Cell>
      <Cell label="Blink" row={1} col={3}>
        <OpacityBlink />
      </Cell>

      {/* Row 2 */}
      <Cell label="Nod" row={2} col={0}>
        <Nod />
      </Cell>
      <Cell label="Wobble / Jelly" row={2} col={1}>
        <Wobble />
      </Cell>
      <Cell label="Heartbeat" row={2} col={2}>
        <Heartbeat />
      </Cell>
      <Cell label="Float / Hover" row={2} col={3}>
        <FloatHover />
      </Cell>
    </div>
  );
};

export const showcaseMeta = {
  id: "ShowcaseAnimations",
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 180,
};
