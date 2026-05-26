// Conveyor Builder — distilled from masahito's "box flow system" CodePen, a
// drag-to-build factory of conveyor belts, pneumatic tubes and little boxes
// with pixel faces. The editor machinery (dev mode, add/delete, config IO,
// pointer dragging, the setInterval physics loop) is gone. What remains is the
// *result*: a busy flat top-down factory where boxes ride belts, get sucked up
// through tubes, drop, and circulate on a seamless loop. All motion is derived
// from useCurrentFrame — no physics, no events, no interactivity.
//
// The original ships a dense default config (~50 boxes, ~14 belts of 5–68
// modules, ~7 pneumatic tube networks) packed into a ~1400×810 band. We honour
// that density: many circulation lanes at different scales plus a wall of decor
// belts so the floor reads as a working plant, not an empty grid.

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// ── Palette lifted from the source CSS ───────────────────────────────────────

const FLOOR = "#b4b3b3"; // .wrapper background
const BACKDROP = "#797979"; // body background
const CONTROL = "#1b8aab"; // --control (belt frame / tube accent)
const TUBE_BODY = "#5a6b72"; // pneumatic pipe body
const TUBE_RIM = "#3f4d52";
const BELT_FRAME = "#2d3338";
const BELT_TREAD_A = "#3c454b";
const BELT_TREAD_B = "#525d64";
const BOX_COLORS = ["#42c6d2", "#797979", "#ffffff"] as const; // box --bg options

// The original is laid out on a 2000×2000 wrapper but the visible config sits in
// a ~1400×820 band. We model the scene in its own coordinate space and scale it
// to cover 1920×1080.

const WORLD_W = 1440;
const WORLD_H = 810;

const BELT_THICKNESS = 22;
const BOX_SIZE = 26;
const LOOP_FRAMES = 600; // exactly 600 frames @ 60fps

// Tread stripe geometry. The loop is only seamless if every animated px offset
// returns to its frame-0 value at the seam. We guarantee that by deriving every
// motion from a phase in [0,1) keyed to (frame % LOOP_FRAMES) and taking it
// modulo the visual period — never from raw seconds.
const STRIPE = 18;
const TREAD_PERIOD = STRIPE * 2; // 36px: one full tread cycle

// ── Geometry primitives ──────────────────────────────────────────────────────

type Belt = {
  x: number; // left edge
  y: number; // center line of the belt frame
  w: number; // width
  dir: 1 | -1; // +1 → tread (and boxes) move right, -1 → move left
  // treadCycles: integer number of full tread cycles per loop. Integer keeps
  // the scroll seamless across the frame-599→0 seam.
  treadCycles: number;
};

type Tube = {
  // a tube is a vertical lift: boxes enter at the bottom, rise to the top
  x: number; // center x
  bottom: number; // y where a box enters
  top: number; // y where a box exits
  w: number; // pipe width
};

// One closed circulation: a belt carries boxes to a lift tube, the tube raises
// them, they drop onto the belt above, ride back the other way, and a drop tube
// lowers them. Each lane is a self-contained ring so the whole field loops.

type Lane = {
  beltLow: Belt; // lower belt
  beltHigh: Belt; // upper belt (opposite direction)
  liftTube: Tube; // lift connecting low → high
  dropTube: Tube; // returns high → low
  boxCount: number;
  colorSeed: number;
  // ringCycles: integer rings travelled per loop (1 = boxes make one full
  // circuit per loop). Integer keeps box motion seamless at the seam.
  ringCycles: number;
};

// Standalone belts purely for visual density (no boxes ride these — they sit in
// the background to fill the factory floor like the original's clutter). The
// original's floor is wall-to-wall belts of every length; we echo that.
const DECOR_BELTS: Belt[] = [
  { x: 40, y: 70, w: 360, dir: 1, treadCycles: 25 },
  { x: 470, y: 64, w: 150, dir: -1, treadCycles: 12 },
  { x: 980, y: 90, w: 250, dir: -1, treadCycles: 18 },
  { x: 1270, y: 120, w: 150, dir: 1, treadCycles: 12 },
  { x: 1180, y: 250, w: 230, dir: 1, treadCycles: 16 },
  { x: 40, y: 300, w: 200, dir: -1, treadCycles: 14 },
  { x: 1230, y: 470, w: 190, dir: -1, treadCycles: 13 },
  { x: 40, y: 470, w: 200, dir: 1, treadCycles: 14 },
  { x: 1170, y: 560, w: 250, dir: 1, treadCycles: 17 },
  { x: 410, y: 760, w: 360, dir: 1, treadCycles: 24 },
  { x: 830, y: 720, w: 300, dir: -1, treadCycles: 20 },
  { x: 1090, y: 730, w: 320, dir: 1, treadCycles: 21 },
  { x: 40, y: 700, w: 300, dir: 1, treadCycles: 20 },
];

const LANES: Lane[] = [
  // Tall left ring
  {
    beltLow: { x: 150, y: 360, w: 560, dir: 1, treadCycles: 38 },
    beltHigh: { x: 150, y: 200, w: 560, dir: -1, treadCycles: 38 },
    liftTube: { x: 686, bottom: 360, top: 200, w: 46 },
    dropTube: { x: 138, bottom: 360, top: 200, w: 46 },
    boxCount: 8,
    colorSeed: 0,
    ringCycles: 1,
  },
  // Wide lower-center ring
  {
    beltLow: { x: 470, y: 660, w: 700, dir: -1, treadCycles: 47 },
    beltHigh: { x: 470, y: 520, w: 700, dir: 1, treadCycles: 47 },
    liftTube: { x: 452, bottom: 660, top: 520, w: 46 },
    dropTube: { x: 1188, bottom: 660, top: 520, w: 46 },
    boxCount: 9,
    colorSeed: 3,
    ringCycles: 1,
  },
  // Compact upper-right ring, faster circulation
  {
    beltLow: { x: 800, y: 300, w: 460, dir: 1, treadCycles: 31 },
    beltHigh: { x: 800, y: 180, w: 460, dir: -1, treadCycles: 31 },
    liftTube: { x: 1238, bottom: 300, top: 180, w: 42 },
    dropTube: { x: 788, bottom: 300, top: 180, w: 42 },
    boxCount: 6,
    colorSeed: 1,
    ringCycles: 2,
  },
  // Small left-bottom ring
  {
    beltLow: { x: 150, y: 580, w: 240, dir: -1, treadCycles: 16 },
    beltHigh: { x: 150, y: 470, w: 240, dir: 1, treadCycles: 16 },
    liftTube: { x: 138, bottom: 580, top: 470, w: 40 },
    dropTube: { x: 378, bottom: 580, top: 470, w: 40 },
    boxCount: 4,
    colorSeed: 2,
    ringCycles: 2,
  },
];

// Each lane forms a ring whose perimeter is travelled at constant speed. We map
// a normalized phase p∈[0,1) onto a position + which segment the box is on.

type RingPoint = {
  x: number;
  y: number;
  z: number; // draw order: tubes (in transit) sit above belts
  inTube: boolean; // true while inside a pipe (hidden behind the pipe body)
  squash: number; // landing plop, 1 = none
  expression: "neutral" | "joy" | "surprise" | "sleepy";
};

function ringLengths(lane: Lane) {
  const beltLen = lane.beltLow.w - 60; // usable run, minus tube footprints
  const liftLen = lane.liftTube.bottom - lane.liftTube.top;
  const dropLen = lane.dropTube.bottom - lane.dropTube.top;
  const total = beltLen + liftLen + beltLen + dropLen;
  return { beltLen, liftLen, dropLen, total };
}

function ringPoint(lane: Lane, p: number): RingPoint {
  const { beltLow, beltHigh, liftTube, dropTube } = lane;
  const { beltLen, liftLen, dropLen, total } = ringLengths(lane);
  const d = (((p % 1) + 1) % 1) * total;

  const lowSurface = beltLow.y - BELT_THICKNESS / 2 - BOX_SIZE / 2;
  const highSurface = beltHigh.y - BELT_THICKNESS / 2 - BOX_SIZE / 2;

  // Segment 1: ride the low belt from the drop tube to the lift tube.
  if (d < beltLen) {
    const t = d / beltLen;
    return {
      x: dropTube.x + (liftTube.x - dropTube.x) * t,
      y: lowSurface,
      z: 1,
      inTube: false,
      squash: plop(t),
      expression: "neutral",
    };
  }

  // Segment 2: lift tube raises the box (low → high).
  let d2 = d - beltLen;
  if (d2 < liftLen) {
    const t = d2 / liftLen;
    const eased = Easing.inOut(Easing.cubic)(t);
    return {
      x: liftTube.x,
      y:
        liftTube.bottom -
        (liftTube.bottom - liftTube.top) * eased -
        BOX_SIZE / 2,
      z: 0, // behind the pipe body
      inTube: true,
      squash: 1,
      expression: "joy",
    };
  }

  // Segment 3: ride the high belt back the other way.
  d2 -= liftLen;
  if (d2 < beltLen) {
    const t = d2 / beltLen;
    return {
      x: liftTube.x + (dropTube.x - liftTube.x) * t,
      y: highSurface,
      z: 1,
      inTube: false,
      squash: plop(t),
      expression: "neutral",
    };
  }

  // Segment 4: drop tube lowers the box (high → low).
  d2 -= beltLen;
  const t = d2 / dropLen;
  const eased = Easing.inOut(Easing.cubic)(t);
  return {
    x: dropTube.x,
    y: dropTube.top + (dropTube.bottom - dropTube.top) * eased - BOX_SIZE / 2,
    z: 0, // behind the pipe body
    inTube: true,
    squash: 1,
    expression: "surprise",
  };
}

// Gentle squash near the start of a belt run, mimicking the original's `plop`
// landing animation when a box meets a surface.
function plop(t: number): number {
  if (t > 0.12) return 1;
  const u = t / 0.12;
  // 1.16 → 0.9 → 1.0 quick bounce
  return interpolate(u, [0, 0.5, 1], [1.16, 0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// ── Visual components ─────────────────────────────────────────────────────────

const BeltView: React.FC<{ belt: Belt; phase: number }> = ({ belt, phase }) => {
  // phase ∈ [0,1) is the loop phase. Tread scrolls treadCycles full periods per
  // loop, so the visible offset returns exactly to its frame-0 value at the
  // seam. Direction follows belt.dir so the tread moves with its boxes.
  const bg = `repeating-linear-gradient(90deg, ${BELT_TREAD_A} 0px, ${BELT_TREAD_A} ${STRIPE}px, ${BELT_TREAD_B} ${STRIPE}px, ${BELT_TREAD_B} ${STRIPE * 2}px)`;
  const offset = belt.dir * phase * belt.treadCycles * TREAD_PERIOD;
  return (
    <div
      style={{
        position: "absolute",
        left: belt.x,
        top: belt.y - BELT_THICKNESS / 2,
        width: belt.w,
        height: BELT_THICKNESS,
        borderRadius: 4,
        background: BELT_FRAME,
        boxShadow: `0 4px 0 rgba(0,0,0,0.18), inset 0 0 0 2px ${CONTROL}`,
        overflow: "hidden",
      }}
    >
      {/* moving tread */}
      <div
        style={{
          position: "absolute",
          inset: 3,
          borderRadius: 2,
          backgroundImage: bg,
          backgroundPositionX: `${offset}px`,
        }}
      />
      {/* end rollers */}
      <div style={rollerStyle("left")} />
      <div style={rollerStyle("right")} />
    </div>
  );
};

const rollerStyle = (side: "left" | "right"): React.CSSProperties => ({
  position: "absolute",
  top: 0,
  bottom: 0,
  width: 8,
  [side]: 0,
  background: `linear-gradient(180deg, ${CONTROL}, ${BELT_FRAME})`,
  borderRadius: 4,
});

const TubeView: React.FC<{ tube: Tube }> = ({ tube }) => {
  const height = tube.bottom - tube.top + BELT_THICKNESS;
  return (
    <div
      style={{
        position: "absolute",
        left: tube.x - tube.w / 2,
        top: tube.top - BELT_THICKNESS / 2,
        width: tube.w,
        height,
        borderRadius: tube.w / 2,
        background: `linear-gradient(90deg, ${TUBE_RIM} 0%, ${TUBE_BODY} 28%, #7d8c93 50%, ${TUBE_BODY} 72%, ${TUBE_RIM} 100%)`,
        boxShadow: `inset 0 0 0 2px ${TUBE_RIM}`,
      }}
    >
      {/* segment rings every 24px, matching the tube's 24px modules */}
      {Array.from({ length: Math.floor(height / 24) }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: i * 24 + 10,
            height: 2,
            background: "rgba(0,0,0,0.22)",
          }}
        />
      ))}
      {/* glossy highlight */}
      <div
        style={{
          position: "absolute",
          top: 4,
          bottom: 4,
          left: tube.w * 0.32,
          width: 3,
          borderRadius: 2,
          background: "rgba(255,255,255,0.35)",
        }}
      />
    </div>
  );
};

const Face: React.FC<{ expression: RingPoint["expression"] }> = ({
  expression,
}) => {
  const ink = "#1c1c1c";
  // simple pixel-art-ish faces echoing the original sprite expressions
  const eye = (cx: number) => (
    <rect x={cx} y={9} width={3} height={3} fill={ink} />
  );
  let mouth: React.ReactNode;
  switch (expression) {
    case "joy":
      mouth = (
        <path d="M9 16 q4 4 8 0" stroke={ink} strokeWidth={2} fill="none" />
      );
      break;
    case "surprise":
      mouth = <rect x={11} y={15} width={4} height={4} fill={ink} />;
      break;
    case "sleepy":
      mouth = <rect x={9} y={17} width={8} height={2} fill={ink} />;
      break;
    default:
      mouth = <rect x={9} y={16} width={8} height={2} fill={ink} />;
  }
  return (
    <svg
      width={BOX_SIZE}
      height={BOX_SIZE}
      viewBox="0 0 26 26"
      style={{ position: "absolute", inset: 0 }}
    >
      {eye(8)}
      {eye(15)}
      {mouth}
    </svg>
  );
};

const BoxView: React.FC<{ pt: RingPoint; color: string }> = ({ pt, color }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: pt.x - BOX_SIZE / 2,
        top: pt.y,
        width: BOX_SIZE,
        height: BOX_SIZE,
        background: color,
        borderRadius: 3,
        boxShadow:
          "0 3px 4px rgba(0,0,0,0.25), inset 0 0 0 2px rgba(0,0,0,0.12)",
        transform: `scaleY(${pt.squash}) scaleX(${1 + (1 - pt.squash) * 0.6})`,
        transformOrigin: "center bottom",
        zIndex: pt.z * 10,
      }}
    >
      <Face expression={pt.expression} />
    </div>
  );
};

// Scattered idle boxes that sit on the floor and standalone belts, filling the
// plant like the original's loose clutter. Deterministic positions; a few drift
// a hair on a sine keyed to the loop phase so they don't read as dead pixels.
type IdleBox = { x: number; y: number; color: string; drift: number };
const IDLE_BOXES: IdleBox[] = [
  { x: 120, y: 70, color: BOX_COLORS[0], drift: 0 },
  { x: 250, y: 70, color: BOX_COLORS[2], drift: 1 },
  { x: 520, y: 64, color: BOX_COLORS[0], drift: 0 },
  { x: 1050, y: 90, color: BOX_COLORS[2], drift: 2 },
  { x: 1130, y: 90, color: BOX_COLORS[1], drift: 0 },
  { x: 1320, y: 120, color: BOX_COLORS[0], drift: 1 },
  { x: 1260, y: 250, color: BOX_COLORS[1], drift: 0 },
  { x: 1340, y: 250, color: BOX_COLORS[2], drift: 3 },
  { x: 90, y: 300, color: BOX_COLORS[0], drift: 0 },
  { x: 190, y: 300, color: BOX_COLORS[1], drift: 2 },
  { x: 1280, y: 470, color: BOX_COLORS[2], drift: 0 },
  { x: 90, y: 470, color: BOX_COLORS[0], drift: 1 },
  { x: 1230, y: 560, color: BOX_COLORS[1], drift: 0 },
  { x: 1320, y: 560, color: BOX_COLORS[2], drift: 2 },
  { x: 480, y: 760, color: BOX_COLORS[0], drift: 0 },
  { x: 560, y: 760, color: BOX_COLORS[2], drift: 3 },
  { x: 660, y: 760, color: BOX_COLORS[1], drift: 0 },
  { x: 900, y: 720, color: BOX_COLORS[0], drift: 1 },
  { x: 1010, y: 720, color: BOX_COLORS[2], drift: 0 },
  { x: 1170, y: 730, color: BOX_COLORS[1], drift: 2 },
  { x: 1270, y: 730, color: BOX_COLORS[0], drift: 0 },
  { x: 110, y: 700, color: BOX_COLORS[2], drift: 1 },
  { x: 230, y: 700, color: BOX_COLORS[1], drift: 0 },
  { x: 320, y: 700, color: BOX_COLORS[0], drift: 3 },
];

// ── Composition ───────────────────────────────────────────────────────────────

export const ConveyorBuilder: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Loop phase ∈ [0,1), wrapping every LOOP_FRAMES for a seamless cycle.
  const phase = (frame % LOOP_FRAMES) / LOOP_FRAMES;

  // Scale the world to cover the frame.
  const scale = useMemo(
    () => Math.max(width / WORLD_W, height / WORLD_H),
    [width, height],
  );
  const offsetX = (width - WORLD_W * scale) / 2;
  const offsetY = (height - WORLD_H * scale) / 2;

  // Precompute box phases per lane so boxes are evenly spaced and already
  // mid-journey on frame 1.
  const lanes = LANES.map((lane) => {
    const points: { pt: RingPoint; color: string }[] = [];
    for (let i = 0; i < lane.boxCount; i++) {
      const phase0 = i / lane.boxCount;
      const p = phase0 + phase * lane.ringCycles;
      const pt = ringPoint(lane, p);
      const color = BOX_COLORS[(i + lane.colorSeed) % BOX_COLORS.length];
      points.push({ pt, color });
    }
    return { lane, points };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BACKDROP }}>
      {/* Factory floor */}
      <div
        style={{
          position: "absolute",
          left: offsetX,
          top: offsetY,
          width: WORLD_W,
          height: WORLD_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          background: FLOOR,
          boxShadow: "inset 0 0 120px rgba(0,0,0,0.18)",
        }}
      >
        {/* subtle floor grid for the engineered look */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Background decoration belts */}
        {DECOR_BELTS.map((b, i) => (
          <BeltView key={`decor-${i}`} belt={b} phase={phase} />
        ))}

        {/* Idle clutter boxes resting on the floor / decor belts */}
        {IDLE_BOXES.map((b, i) => {
          const dy =
            b.drift === 0
              ? 0
              : Math.sin(phase * Math.PI * 2 * b.drift) * 1.5;
          return (
            <BoxView
              key={`idle-${i}`}
              pt={{
                x: b.x,
                y: b.y - BELT_THICKNESS / 2 - BOX_SIZE / 2 + dy,
                z: 1,
                inTube: false,
                squash: 1,
                expression: "neutral",
              }}
              color={b.color}
            />
          );
        })}

        {/* Drop/return tubes drawn behind belts so descending boxes hide inside */}
        {lanes.map(({ lane }, i) => (
          <TubeView key={`tube-drop-${i}`} tube={lane.dropTube} />
        ))}

        {/* Lift tubes also drawn before belts so rising boxes hide inside */}
        {lanes.map(({ lane }, i) => (
          <TubeView key={`tube-lift-${i}`} tube={lane.liftTube} />
        ))}

        {/* Boxes that are currently inside a tube — render behind the belts and
            pipe bodies so the pipe occludes them as they travel through it */}
        {lanes.map(({ points }, li) =>
          points
            .filter((b) => b.pt.inTube)
            .map((b, bi) => (
              <BoxView key={`tbox-${li}-${bi}`} pt={b.pt} color={b.color} />
            )),
        )}

        {/* Lane belts (drawn over the tube bodies so the belt edge meets the pipe) */}
        {lanes.map(({ lane }, i) => (
          <React.Fragment key={`belts-${i}`}>
            <BeltView belt={lane.beltHigh} phase={phase} />
            <BeltView belt={lane.beltLow} phase={phase} />
          </React.Fragment>
        ))}

        {/* Boxes riding on belts — render above the belts */}
        {lanes.map(({ points }, li) =>
          points
            .filter((b) => !b.pt.inTube)
            .map((b, bi) => (
              <BoxView key={`box-${li}-${bi}`} pt={b.pt} color={b.color} />
            )),
        )}
      </div>

      {/* Vignette to seat the scene as a background */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(120% 120% at 50% 45%, transparent 55%, rgba(0,0,0,0.28) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
