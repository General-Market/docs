// Source: CodePen "Stage Grid" (numbered command-path stages with orbiting rings)
//
// Original: a 2x2 grid of bordered "stages", each labelled "01 / Command Path",
// "02 / Data Signals", etc., with a GSAP-animated ring/shape group that loops.
// Scroll wasn't the driver in the original — the loops ran continuously — so
// here we add a frame-driven vertical pan that walks the grid stage by stage,
// holding briefly on each while its ring group keeps animating underneath.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// ── Palette (from the original :root custom properties) ──────────────────────

const COLORS = {
  bg: "#0f0f10",
  white: "#e9e9ea",
  grid: "rgba(255, 255, 255, 0.35)",
  green: "#7cffc4",
  border: "rgba(255, 255, 255, 0.18)",
};

const FONT = '"SF Pro Display", "Inter", system-ui, -apple-system, sans-serif';

// ── Easing helpers ───────────────────────────────────────────────────────────

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// GSAP elastic.out(1, p) — used for the ring snap-backs in the original.
const elasticOut = (t: number, period = 0.25): number => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const s = (period / (2 * Math.PI)) * Math.asin(1);
  return (
    Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / period) + 1
  );
};

// GSAP expo.in / expo.out / expo.inOut
const expoIn = (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1)));
const expoOut = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
const expoInOut = (t: number) => {
  if (t === 0 || t === 1) return t;
  if (t < 0.5) return 0.5 * Math.pow(2, 20 * t - 10);
  return 1 - 0.5 * Math.pow(2, -20 * t + 10);
};
const power2InOut = Easing.inOut(Easing.poly(2));

// A looping local clock for the ring animations. The original timelines all use
// repeat:-1 with repeatDelay:0.4, so we wrap a single phase length and ease the
// segments by hand. `loopPhase` returns 0..1 across `len` seconds.
const loopPhase = (timeSec: number, len: number): number => {
  const m = ((timeSec % len) + len) % len;
  return m / len;
};

// Sub-segment: progress of a clip starting at `a` for `dur` seconds within a
// phase of total `len` seconds, given absolute phase time `t` (0..len).
const seg = (t: number, a: number, dur: number): number =>
  clamp01((t - a) / dur);

// ── Stage 01 — Command Path: three stacked rings split apart then realign ────

const Stage01: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const len = 2.7; // 0.4 repeatDelay + ~2.3 of motion
  const t = loopPhase(frame / fps, len) * len;

  // Ring 1 (dashed, +80) and ring 2 (solid, -80) converge to 0, then spread back.
  const converge = expoIn(seg(t, 0.2, 0.6)); // both x -> 0
  const spread = elasticOut(seg(t, 1.3, 1.0)); // back out to their offsets
  const x1Final = t < 1.3 ? 80 * (1 - converge) : 80 * spread;
  const x2Final = t < 1.3 ? -80 * (1 - converge) : -80 * spread;

  // Whole group rotateY: 117 -> 0 -> 117
  let rotY = 117;
  if (t >= 0.5 && t < 1.0) rotY = 117 * (1 - expoIn(seg(t, 0.5, 0.5)));
  else if (t >= 1.0 && t < 1.5) rotY = 117 * expoOut(seg(t, 1.0, 0.5));
  else if (t >= 1.5) rotY = 117;

  const ring = (
    extra: React.CSSProperties,
    tx: number
  ): React.CSSProperties => ({
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: "50%",
    top: "50%",
    left: "50%",
    transform: `translate(-50%, -50%) translateX(${tx}px) rotateY(${rotY}deg)`,
    ...extra,
  });

  return (
    <div style={{ position: "relative", width: 300, height: 300, perspective: 900 }}>
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
        <div style={ring({ border: `3px dashed ${COLORS.white}`, opacity: 0.7, zIndex: 1 }, x1Final)} />
        <div style={ring({ border: `3px solid ${COLORS.white}`, opacity: 0.7, zIndex: 2 }, x2Final)} />
        <div style={ring({ border: `3px solid ${COLORS.green}`, zIndex: 3 }, 0)} />
      </div>
    </div>
  );
};

// ── Stage 02 — Data Signals: inner pair of rings rotates inside an outer ring ─

const Stage02: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const len = 2.9; // 0.3 offset + 2.5 spin + 0.1 settle
  const t = loopPhase(frame / fps, len) * len;
  const spin = expoInOut(seg(t, 0.3, 2.5)) * 360;

  return (
    <div style={{ position: "relative", width: 320, height: 240 }}>
      {/* outer */}
      <div
        style={{
          position: "absolute",
          width: 220,
          height: 220,
          borderRadius: "50%",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          border: "2px solid rgba(255,255,255,0.28)",
        }}
      />
      {/* inner pair, rotated together */}
      <div
        style={{
          position: "absolute",
          width: 220,
          height: 220,
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) rotate(${spin}deg)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 130,
            height: 130,
            borderRadius: "50%",
            top: "50%",
            left: 0,
            transform: "translateY(-50%)",
            border: "2px dashed rgba(255,255,255,0.9)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 130,
            height: 130,
            borderRadius: "50%",
            top: "50%",
            right: 0,
            transform: "translateY(-50%)",
            border: `2px solid ${COLORS.green}`,
          }}
        />
      </div>
    </div>
  );
};

// ── Stage 03 — Build Systems: square + circle scale/colour, dashed ring turns ─

const Stage03: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const len = 3.0;
  const t = loopPhase(frame / fps, len) * len;

  // shape-3 dashed ring: rotation 0 -> 45 -> 0 (elastic back)
  let rot = 0;
  if (t >= 0.3 && t < 1.2) rot = 45 * power2InOut(seg(t, 0.3, 0.9));
  else if (t >= 1.2 && t < 1.4) rot = 45;
  else if (t >= 1.4) rot = 45 * (1 - elasticOut(seg(t, 1.4, 1.0)));

  // shape-2 green circle: scale 1 -> 0.75 -> 1, border green -> white -> green
  let scale = 1;
  let toWhite = 0;
  if (t >= 0.4 && t < 1.4) {
    scale = 1 - 0.25 * power2InOut(seg(t, 0.4, 1.0));
    toWhite = power2InOut(seg(t, 0.4, 1.0));
  } else if (t >= 1.4) {
    scale = 0.75 + 0.25 * elasticOut(seg(t, 1.4, 1.0));
    toWhite = 1 - elasticOut(seg(t, 1.4, 1.0));
  }
  const borderColor = toWhite > 0.5 ? COLORS.white : COLORS.green;

  return (
    <div style={{ position: "relative", width: 320, height: 320, overflow: "hidden" }}>
      {/* square */}
      <div
        style={{
          position: "absolute",
          width: 180,
          height: 180,
          left: 42,
          top: 98,
          border: "1.5px solid rgba(255,255,255,0.28)",
        }}
      />
      {/* green circle that scales + recolours */}
      <div
        style={{
          position: "absolute",
          width: 180,
          height: 180,
          left: 42,
          top: 98,
          borderRadius: "50%",
          border: `1.5px solid ${borderColor}`,
          transform: `scale(${scale})`,
        }}
      />
      {/* dashed circle that rotates */}
      <div
        style={{
          position: "absolute",
          width: 180,
          height: 180,
          left: 124,
          top: 16,
          borderRadius: "50%",
          border: "2px dashed rgba(255,255,255,0.9)",
          transform: `rotate(${rot}deg)`,
        }}
      />
    </div>
  );
};

// ── Stage 04 — Discovery Map: three tilted rings spin around a shared axis ────

const Stage04: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const len = 3.4; // 0.4 delay + 3.0 spin (staggered)
  const t = loopPhase(frame / fps, len) * len;
  const base = [60, 75, 40]; // left, center, right initial rotateY
  const order = [1, 0, 2]; // center, left, right stagger order (matches original)

  const ringSpin = (idx: number): number => {
    const stagger = order.indexOf(idx) * 0.3;
    return base[idx] + 360 * expoInOut(seg(t, stagger, 3.0));
  };

  const tiltRing = (
    rotY: number,
    style: React.CSSProperties
  ): React.CSSProperties => ({
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: "50%",
    top: "50%",
    left: "50%",
    transform: `translate(-50%, -50%) rotateY(${rotY}deg)`,
    ...style,
  });

  return (
    <div
      style={{
        position: "relative",
        width: 320,
        height: 240,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: 900,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 220,
          height: 220,
          borderRadius: "50%",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          border: `1.5px solid ${COLORS.white}`,
        }}
      />
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
        <div style={tiltRing(ringSpin(0), { border: `3px dashed ${COLORS.grid}` })} />
        <div style={tiltRing(ringSpin(1), { border: `3px solid ${COLORS.green}` })} />
        <div style={tiltRing(ringSpin(2), { border: `3px dashed ${COLORS.grid}` })} />
      </div>
    </div>
  );
};

// ── Stage shell — label + animated visual, with a per-stage reveal ───────────

interface StageDef {
  index: string;
  title: [string, string];
  Visual: React.FC;
}

const STAGES: StageDef[] = [
  { index: "01", title: ["Command", "Path"], Visual: Stage01 },
  { index: "02", title: ["Data", "Signals"], Visual: Stage02 },
  { index: "03", title: ["Build", "Systems"], Visual: Stage03 },
  { index: "04", title: ["Discovery", "Map"], Visual: Stage04 },
];

const StageCell: React.FC<{ def: StageDef; reveal: number; isRight: boolean; isBottom: boolean }> = ({
  def,
  reveal,
  isRight,
  isBottom,
}) => {
  const { Visual } = def;
  const labelY = interpolate(reveal, [0, 1], [24, 0], { easing: Easing.out(Easing.cubic) });

  return (
    <div
      style={{
        position: "relative",
        padding: 56,
        minHeight: 540,
        borderRight: isRight ? "none" : `1px solid ${COLORS.border}`,
        borderBottom: isBottom ? "none" : `1px solid ${COLORS.border}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "28px 1fr",
          columnGap: 18,
          alignItems: "start",
          marginBottom: 32,
          opacity: reveal,
          transform: `translateY(${labelY}px)`,
        }}
      >
        <span style={{ opacity: 0.4, fontSize: 18, marginTop: 8 }}>{def.index}</span>
        <h1
          style={{
            fontWeight: 500,
            lineHeight: 1.05,
            margin: 0,
            fontSize: 52,
            letterSpacing: "-0.022em",
            color: COLORS.white,
          }}
        >
          {def.title[0]}
          <br />
          {def.title[1]}
        </h1>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: interpolate(reveal, [0, 0.4, 1], [0, 0.3, 1]),
        }}
      >
        <Visual />
      </div>
    </div>
  );
};

// ── Main composition ─────────────────────────────────────────────────────────

export const CommandPath: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Frame-driven vertical pan: the grid is taller than the frame, and we glide
  // down it so the two rows pass through the optical center, holding on each.
  // Pan timeline (in frames over 600): settle row 1, hold, glide to row 2, hold.
  const panProgress = interpolate(
    frame,
    [20, 150, 300, 430, 580],
    [0, 0, 1, 1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) }
  );

  const FRAME_W = 1180;
  const ROW_H = 540;
  const GRID_TOP = (height - ROW_H) / 2; // first row centered to start
  // Pan shifts the grid up by one row height as panProgress goes 0->1.
  const panY = GRID_TOP - panProgress * ROW_H;

  // Per-stage reveal: row 1 reveals early, row 2 reveals as the pan reaches it.
  const reveal = (i: number): number => {
    if (i < 2) return interpolate(frame, [20 + i * 14, 70 + i * 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return interpolate(frame, [180 + (i - 2) * 14, 250 + (i - 2) * 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  };

  // Whole-frame entrance.
  const frameOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const headerOpacity = interpolate(frame, [4, 22, 560, 590], [0, 1, 1, 0.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        fontFamily: FONT,
        color: COLORS.white,
        overflow: "hidden",
      }}
    >
      {/* Faint atmospheric wash */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(124,255,196,0.06), transparent 60%), radial-gradient(ellipse at 80% 90%, rgba(124,255,196,0.04), transparent 55%)",
        }}
      />

      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: 48,
          left: 60,
          right: 60,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 30,
          opacity: headerOpacity,
        }}
      >
        <span style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 2, opacity: 0.6 }}>
          The Command Path
        </span>
        <span style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 2, opacity: 0.6 }}>
          {String(Math.min(STAGES.length, Math.floor(panProgress * 2) + 2)).padStart(2, "0")} / {STAGES.length}
        </span>
      </div>

      {/* The panning grid */}
      <div
        style={{
          position: "absolute",
          top: panY,
          left: (width - FRAME_W) / 2,
          width: FRAME_W,
          border: `1px solid ${COLORS.border}`,
          opacity: frameOpacity,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {STAGES.map((def, i) => (
            <StageCell
              key={def.index}
              def={def}
              reveal={reveal(i)}
              isRight={i % 2 === 1}
              isBottom={i >= STAGES.length - 2}
            />
          ))}
        </div>
      </div>

      {/* Top/bottom edge vignettes so the pan reads as motion through a viewport */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 140,
          background: `linear-gradient(to bottom, ${COLORS.bg}, transparent)`,
          zIndex: 20,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 140,
          background: `linear-gradient(to top, ${COLORS.bg}, transparent)`,
          zIndex: 20,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
