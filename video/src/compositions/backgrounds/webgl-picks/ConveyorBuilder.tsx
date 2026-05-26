// Conveyor Builder — a faithful replica of masahito's "box flow system" CodePen
// (ma5a.com), a flat top-down factory of conveyor belts, pneumatic tubes and
// little boxes with pixel faces. The editor machinery (dev mode, add/delete,
// config IO, pointer dragging, the setInterval physics loop) is gone; what
// remains is the *look* of the running plant, on a seamless 600-frame loop
// driven entirely by useCurrentFrame.
//
// The three visual signatures of the original, matched here:
//   • belts  — a dashed black pill outline with two solid pulley circles; the
//              dash flows around the perimeter to read as a moving tread.
//   • tubes  — thin white lines that route in right angles with a small white
//              entrance triangle, exactly like the pneumatic pipes.
//   • boxes  — 20px flat colored squares wearing the original pixel-face sprite
//              (neutral / joy / surprise / sleepy), pulled from the source CSS.

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
const INK = "#0d0d0d"; // belt outline + pulleys (near-black)
const TUBE = "#ffffff"; // pneumatic pipe line
const BOX_COLORS = ["#42c6d2", "#797979", "#ffffff"] as const; // box --bg options

// The original lives on a 2000×2000 wrapper but the visible config sits in a
// ~1440×810 band. We model the scene in its own space and scale it to cover
// 1920×1080 (uniform 1.333× — both axes match).

const WORLD_W = 1440;
const WORLD_H = 810;

const PILL_H = 44; // belt pill outer height
const PULLEY_R = 13; // pulley circle radius
const STROKE = 3; // dashed-outline stroke width
const DASH = 13; // dash length …
const GAP = 9; // … and gap → period 22, animated for tread motion
const DASH_PERIOD = DASH + GAP;
const BOX_SIZE = 22;
const TUBE_W = 2.5; // white pipe line thickness
const LOOP_FRAMES = 600; // exactly 600 frames @ 60fps

// Original box face sprite (40×10 = four 10×10 frames: neutral, joy, surprise,
// sleepy), copied verbatim from the source `.box::after` background-image.
const BOX_SPRITE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAKCAYAAADGmhxQAAAAjElEQVR4AeyRUQqAMAxDp/e/s/IGGTHM6fBHQSEsS9Ja61pe/vwDPv1Bn9ngNvjSkXdWNqpxz3n2qt7sBikCvWY9PXPTdw24DCrdg4OMowHpzqXpdM+5fJ3V04AS2YJDep6egafvd3zgWnJ8R/NzQKZ2tGAQz8DDnr56D+clB5zufKOAF4KrKBlwyO0AAAD//+gQ4F8AAAAGSURBVAMAe0AYFZUAvYEAAAAASUVORK5CYII=";

const FACE_FRAME: Record<RingPoint["expression"], number> = {
  neutral: 0,
  joy: 1,
  surprise: 2,
  sleepy: 3,
};

// ── Geometry primitives ──────────────────────────────────────────────────────

type Belt = {
  x: number; // left edge
  y: number; // center line of the belt pill
  w: number; // width
  dir: 1 | -1; // +1 → tread (and boxes) move right, -1 → move left
  // treadCycles: integer dash periods scrolled per loop. Integer keeps the
  // dash flow seamless across the frame-599→0 seam.
  treadCycles: number;
};

type Tube = {
  // a tube is a vertical lift: boxes enter at the bottom, rise to the top
  x: number; // center x
  bottom: number; // y where a box enters (low belt center)
  top: number; // y where a box exits (high belt center)
};

// One closed circulation: a belt carries boxes to a lift tube, the tube raises
// them, they ride back the other way on the belt above, and a drop tube lowers
// them. Each lane is a self-contained ring so the whole field loops.

type Lane = {
  beltLow: Belt;
  beltHigh: Belt;
  liftTube: Tube;
  dropTube: Tube;
  boxCount: number;
  colorSeed: number;
  // ringCycles: integer rings travelled per loop (1 = one full circuit/loop).
  ringCycles: number;
};

// Standalone belts purely for visual density — the original's floor is
// wall-to-wall belts of every length. No boxes ride these.
const DECOR_BELTS: Belt[] = [
  { x: 40, y: 80, w: 360, dir: 1, treadCycles: 17 },
  { x: 470, y: 74, w: 150, dir: -1, treadCycles: 7 },
  { x: 980, y: 100, w: 250, dir: -1, treadCycles: 12 },
  { x: 1270, y: 130, w: 150, dir: 1, treadCycles: 7 },
  { x: 1180, y: 260, w: 230, dir: 1, treadCycles: 11 },
  { x: 40, y: 310, w: 200, dir: -1, treadCycles: 9 },
  { x: 1230, y: 480, w: 190, dir: -1, treadCycles: 9 },
  { x: 40, y: 480, w: 200, dir: 1, treadCycles: 9 },
  { x: 1170, y: 570, w: 250, dir: 1, treadCycles: 12 },
  { x: 410, y: 770, w: 360, dir: 1, treadCycles: 17 },
  { x: 830, y: 730, w: 300, dir: -1, treadCycles: 14 },
  { x: 1090, y: 740, w: 320, dir: 1, treadCycles: 15 },
  { x: 40, y: 710, w: 300, dir: 1, treadCycles: 14 },
];

const LANES: Lane[] = [
  // Tall left ring
  {
    beltLow: { x: 150, y: 370, w: 560, dir: 1, treadCycles: 25 },
    beltHigh: { x: 150, y: 210, w: 560, dir: -1, treadCycles: 25 },
    liftTube: { x: 692, bottom: 370, top: 210 },
    dropTube: { x: 132, bottom: 370, top: 210 },
    boxCount: 8,
    colorSeed: 0,
    ringCycles: 1,
  },
  // Wide lower-center ring
  {
    beltLow: { x: 470, y: 670, w: 700, dir: -1, treadCycles: 31 },
    beltHigh: { x: 470, y: 530, w: 700, dir: 1, treadCycles: 31 },
    liftTube: { x: 452, bottom: 670, top: 530 },
    dropTube: { x: 1188, bottom: 670, top: 530 },
    boxCount: 9,
    colorSeed: 3,
    ringCycles: 1,
  },
  // Compact upper-right ring, faster circulation
  {
    beltLow: { x: 800, y: 310, w: 460, dir: 1, treadCycles: 21 },
    beltHigh: { x: 800, y: 190, w: 460, dir: -1, treadCycles: 21 },
    liftTube: { x: 1242, bottom: 310, top: 190 },
    dropTube: { x: 782, bottom: 310, top: 190 },
    boxCount: 6,
    colorSeed: 1,
    ringCycles: 2,
  },
  // Small left-bottom ring
  {
    beltLow: { x: 150, y: 590, w: 240, dir: -1, treadCycles: 11 },
    beltHigh: { x: 150, y: 480, w: 240, dir: 1, treadCycles: 11 },
    liftTube: { x: 132, bottom: 590, top: 480 },
    dropTube: { x: 372, bottom: 590, top: 480 },
    boxCount: 4,
    colorSeed: 2,
    ringCycles: 2,
  },
];

// Decorative white pipe routes — the snaking pneumatic tubes that fill the
// floor in the original. Each is a polyline of right-angle points; we draw it
// as a thin white line and (optionally) cap one end with an entrance triangle.
type Route = { pts: [number, number][]; entrance?: "up" | "down" };
const DECOR_ROUTES: Route[] = [
  { pts: [[640, 70], [640, 150], [900, 150], [900, 70]] },
  { pts: [[920, 70], [920, 200], [1120, 200], [1120, 70]], entrance: "down" },
  { pts: [[300, 130], [300, 420], [120, 420]] },
  { pts: [[760, 360], [760, 470], [560, 470]] },
  { pts: [[1340, 300], [1340, 620], [1240, 620]] },
  { pts: [[60, 560], [60, 760]], entrance: "up" },
  { pts: [[980, 560], [980, 700], [700, 700]] },
  { pts: [[1100, 440], [1100, 520], [1320, 520], [1320, 440]], entrance: "up" },
];

// Each lane forms a ring whose perimeter is travelled at constant speed. We map
// a normalized phase p∈[0,1) onto a position and which segment the box is on.

type RingPoint = {
  x: number;
  y: number; // box top
  inTube: boolean;
  squash: number; // landing plop, 1 = none
  expression: "neutral" | "joy" | "surprise" | "sleepy";
};

// Boxes sit on top of the belt pill, overlapping its top edge a touch.
function surfaceY(belt: Belt): number {
  return belt.y - PILL_H / 2 - BOX_SIZE + 9;
}

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

  const lowSurface = surfaceY(beltLow);
  const highSurface = surfaceY(beltHigh);

  // Segment 1: ride the low belt from the drop tube to the lift tube.
  if (d < beltLen) {
    const t = d / beltLen;
    return {
      x: dropTube.x + (liftTube.x - dropTube.x) * t,
      y: lowSurface,
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
      y: lowSurface + (highSurface - lowSurface) * eased,
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
    y: highSurface + (lowSurface - highSurface) * eased,
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
  return interpolate(u, [0, 0.5, 1], [1.16, 0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// ── Visual components ─────────────────────────────────────────────────────────

// A belt: dashed pill outline + two pulley circles. The dash offset scrolls an
// integer number of periods per loop so the tread reads as moving yet returns
// exactly to frame 0 at the seam.
const BeltView: React.FC<{ belt: Belt; phase: number }> = ({ belt, phase }) => {
  const w = belt.w;
  const h = PILL_H;
  const offset = -belt.dir * phase * belt.treadCycles * DASH_PERIOD;
  const cy = h / 2;
  const cx1 = PULLEY_R + 8;
  const cx2 = w - PULLEY_R - 8;
  return (
    <svg
      width={w}
      height={h}
      style={{ position: "absolute", left: belt.x, top: belt.y - h / 2 }}
    >
      <rect
        x={STROKE / 2}
        y={STROKE / 2}
        width={w - STROKE}
        height={h - STROKE}
        rx={(h - STROKE) / 2}
        ry={(h - STROKE) / 2}
        fill="none"
        stroke={INK}
        strokeWidth={STROKE}
        strokeDasharray={`${DASH} ${GAP}`}
        strokeDashoffset={offset}
      />
      <circle cx={cx1} cy={cy} r={PULLEY_R} fill={INK} />
      <circle cx={cx2} cy={cy} r={PULLEY_R} fill={INK} />
    </svg>
  );
};

// Thin white pipe line for the lane lift/drop tubes (vertical), with a small
// entrance triangle at the bottom.
const LaneTube: React.FC<{ tube: Tube }> = ({ tube }) => {
  const top = Math.min(tube.top, tube.bottom);
  const bottom = Math.max(tube.top, tube.bottom);
  return (
    <>
      <line
        x1={tube.x}
        y1={top}
        x2={tube.x}
        y2={bottom}
        stroke={TUBE}
        strokeWidth={TUBE_W}
        strokeLinecap="round"
      />
      <Triangle x={tube.x} y={bottom + 2} dir="up" />
    </>
  );
};

const Triangle: React.FC<{ x: number; y: number; dir: "up" | "down" }> = ({
  x,
  y,
  dir,
}) => {
  const s = 6;
  const pts =
    dir === "up"
      ? `${x - s},${y + s} ${x + s},${y + s} ${x},${y - s}`
      : `${x - s},${y - s} ${x + s},${y - s} ${x},${y + s}`;
  return <polygon points={pts} fill={TUBE} />;
};

// A decorative white route: connected right-angle line segments.
const RouteView: React.FC<{ route: Route }> = ({ route }) => {
  const d = route.pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
  const last = route.pts[route.pts.length - 1];
  const first = route.pts[0];
  const cap = route.entrance ? (first[1] >= last[1] ? first : last) : null;
  return (
    <>
      <path
        d={d}
        fill="none"
        stroke={TUBE}
        strokeWidth={TUBE_W}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {cap && route.entrance && (
        <Triangle x={cap[0]} y={cap[1]} dir={route.entrance} />
      )}
    </>
  );
};

// A flat colored box wearing the original pixel-face sprite.
const BoxView: React.FC<{ pt: RingPoint; color: string }> = ({ pt, color }) => {
  const frame = FACE_FRAME[pt.expression];
  return (
    <div
      style={{
        position: "absolute",
        left: pt.x - BOX_SIZE / 2,
        top: pt.y,
        width: BOX_SIZE,
        height: BOX_SIZE,
        background: color,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.10)",
        transform: `scaleY(${pt.squash}) scaleX(${1 + (1 - pt.squash) * 0.6})`,
        transformOrigin: "center bottom",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${BOX_SPRITE})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${BOX_SIZE * 4}px ${BOX_SIZE}px`,
          backgroundPosition: `-${frame * BOX_SIZE}px 0`,
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
};

// Scattered idle boxes that rest on the floor and decor belts, filling the
// plant like the original's loose clutter. Deterministic positions; a few drift
// a hair on a sine keyed to the loop phase so they don't read as dead pixels.
type IdleBox = { x: number; y: number; color: string; drift: number };
const IDLE_BOXES: IdleBox[] = [
  { x: 120, y: 80, color: BOX_COLORS[0], drift: 0 },
  { x: 250, y: 80, color: BOX_COLORS[2], drift: 1 },
  { x: 520, y: 74, color: BOX_COLORS[0], drift: 0 },
  { x: 1050, y: 100, color: BOX_COLORS[2], drift: 2 },
  { x: 1130, y: 100, color: BOX_COLORS[1], drift: 0 },
  { x: 1320, y: 130, color: BOX_COLORS[0], drift: 1 },
  { x: 1260, y: 260, color: BOX_COLORS[1], drift: 0 },
  { x: 1340, y: 260, color: BOX_COLORS[2], drift: 3 },
  { x: 90, y: 310, color: BOX_COLORS[0], drift: 0 },
  { x: 190, y: 310, color: BOX_COLORS[1], drift: 2 },
  { x: 1280, y: 480, color: BOX_COLORS[2], drift: 0 },
  { x: 90, y: 480, color: BOX_COLORS[0], drift: 1 },
  { x: 1230, y: 570, color: BOX_COLORS[1], drift: 0 },
  { x: 1320, y: 570, color: BOX_COLORS[2], drift: 2 },
  { x: 480, y: 770, color: BOX_COLORS[0], drift: 0 },
  { x: 560, y: 770, color: BOX_COLORS[2], drift: 3 },
  { x: 660, y: 770, color: BOX_COLORS[1], drift: 0 },
  { x: 900, y: 730, color: BOX_COLORS[0], drift: 1 },
  { x: 1010, y: 730, color: BOX_COLORS[2], drift: 0 },
  { x: 1170, y: 740, color: BOX_COLORS[1], drift: 2 },
  { x: 1270, y: 740, color: BOX_COLORS[0], drift: 0 },
  { x: 110, y: 710, color: BOX_COLORS[2], drift: 1 },
  { x: 230, y: 710, color: BOX_COLORS[1], drift: 0 },
  { x: 320, y: 710, color: BOX_COLORS[0], drift: 3 },
];

// ── Composition ───────────────────────────────────────────────────────────────

export const ConveyorBuilder: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Loop phase ∈ [0,1), wrapping every LOOP_FRAMES for a seamless cycle.
  const phase = (frame % LOOP_FRAMES) / LOOP_FRAMES;

  const scale = useMemo(
    () => Math.max(width / WORLD_W, height / WORLD_H),
    [width, height],
  );
  const offsetX = (width - WORLD_W * scale) / 2;
  const offsetY = (height - WORLD_H * scale) / 2;

  // Precompute box phases per lane so boxes are evenly spaced and already
  // mid-journey on frame 0.
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

  const allBelts = [...DECOR_BELTS, ...LANES.flatMap((l) => [l.beltHigh, l.beltLow])];

  return (
    <AbsoluteFill style={{ backgroundColor: BACKDROP }}>
      {/* Factory floor — plain, no grid (matches the source .wrapper) */}
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
        }}
      >
        {/* White pipe routes drawn first, so belts sit over their endpoints */}
        <svg
          width={WORLD_W}
          height={WORLD_H}
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          {DECOR_ROUTES.map((r, i) => (
            <RouteView key={`route-${i}`} route={r} />
          ))}
          {lanes.map(({ lane }, i) => (
            <React.Fragment key={`lane-tubes-${i}`}>
              <LaneTube tube={lane.dropTube} />
              <LaneTube tube={lane.liftTube} />
            </React.Fragment>
          ))}
        </svg>

        {/* Idle clutter boxes resting on the floor / decor belts */}
        {IDLE_BOXES.map((b, i) => {
          const dy =
            b.drift === 0 ? 0 : Math.sin(phase * Math.PI * 2 * b.drift) * 1.5;
          return (
            <BoxView
              key={`idle-${i}`}
              pt={{
                x: b.x,
                y: b.y - PILL_H / 2 - BOX_SIZE + 9 + dy,
                inTube: false,
                squash: 1,
                expression: "neutral",
              }}
              color={b.color}
            />
          );
        })}

        {/* All belts — dashed pills with pulleys */}
        {allBelts.map((b, i) => (
          <BeltView key={`belt-${i}`} belt={b} phase={phase} />
        ))}

        {/* Boxes on belts and in tubes, all riding above the belts */}
        {lanes.map(({ points }, li) =>
          points.map((b, bi) => (
            <BoxView key={`box-${li}-${bi}`} pt={b.pt} color={b.color} />
          )),
        )}
      </div>

      {/* Faint vignette to seat the scene as a background */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(120% 120% at 50% 45%, transparent 62%, rgba(0,0,0,0.22) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
