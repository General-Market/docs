/**
 * Callout — animated docs annotation: ring + numbered chip + curved arrow +
 * caption. The static geometry is ported straight from the docs capture overlay
 * (crx-mono/.../docs-shots/annotate.mjs): a rounded highlight ring on the target,
 * a numbered accent chip offset on `side`, a tapered quadratic arrow from chip to
 * the target edge with a triangle head, and a white-haloed caption beside the chip
 * so it reads over any screenshot.
 *
 * Where annotate.mjs paints once, this springs in: the whole annotation scales
 * 0.9→1, rises a few px, and fades up on the house spring from appearFrame; the
 * arrow draws on with a stroke-dashoffset interpolate. All frame-driven — no CSS
 * animation — so it renders identically headless.
 *
 * Brand: accent = GM Electric (#2D5BFF); caption = Bricolage Grotesque; chip
 * number = Commit Mono. target is in CANVAS coords (1920×1080).
 */

import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { font, monoFont } from "../../common/fonts";

const GM_ELECTRIC = "#2D5BFF";

// House spring (GMStyle §6) — the one settle for arrivals.
const HOUSE_SPRING = {
  config: { mass: 0.6, damping: 16, stiffness: 120 },
  durationInFrames: 26,
};

// Geometry, ported from annotate.mjs and scaled up for the 1920×1080 canvas
// (the overlay was authored against a 1440-wide viewport).
const PAD = 8; // ring inset around the target
const RING_RX = 12; // ring corner radius
const GAP = 18; // arrowhead sits this far off the target edge
const REACH = 104; // chip sits GAP+REACH out from the edge
const BEND = 18; // quadratic control offset, perpendicular to the run
const CHIP_R = 20; // numbered chip radius
const ARROW_W = 3; // arrow stroke width
const HEAD = 12; // arrowhead leg length
const CAPTION_GAP = 30; // caption offset from the chip centre

type Side = "left" | "right" | "top" | "bottom";

// Quadratic length is path-dependent; for a gentle bow the chord is close
// enough to drive the draw-on dash. Sample a few points for a tighter estimate.
function quadLength(
  p0: [number, number],
  c: [number, number],
  p1: [number, number],
): number {
  const N = 16;
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0];
    const y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1];
    len += Math.hypot(x - prev[0], y - prev[1]);
    prev = [x, y];
  }
  return len;
}

export const Callout: React.FC<{
  target: { x: number; y: number; w: number; h: number };
  label: string;
  side: Side;
  index: number;
  appearFrame: number;
}> = ({ target, label, side, index, appearFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - appearFrame;

  // Spring-in: scale 0.9→1, slight rise, opacity. House spring.
  const s = spring({
    fps,
    frame: local,
    config: HOUSE_SPRING.config,
    durationInFrames: HOUSE_SPRING.durationInFrames,
  });
  const scale = interpolate(s, [0, 1], [0.9, 1]);
  const rise = interpolate(s, [0, 1], [8, 0]);
  const opacity = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Target rect in canvas coords.
  const rx = target.x;
  const ry = target.y;
  const rw = target.w;
  const rh = target.h;
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;

  // Head (just off the target edge) and tail (chip) per side — annotate.mjs math.
  let head: [number, number];
  let tail: [number, number];
  let labelAnchor: "start" | "end" | "middle";
  if (side === "left") {
    head = [rx - GAP, cy];
    tail = [rx - GAP - REACH, cy];
    labelAnchor = "end";
  } else if (side === "top") {
    head = [cx, ry - GAP];
    tail = [cx, ry - GAP - REACH];
    labelAnchor = "middle";
  } else if (side === "bottom") {
    head = [cx, ry + rh + GAP];
    tail = [cx, ry + rh + GAP + REACH];
    labelAnchor = "middle";
  } else {
    head = [rx + rw + GAP, cy];
    tail = [rx + rw + GAP + REACH, cy];
    labelAnchor = "start";
  }

  // Quadratic control point, bowed perpendicular to the run.
  const mx = (tail[0] + head[0]) / 2;
  const my = (tail[1] + head[1]) / 2;
  const bend: [number, number] =
    side === "left" || side === "right" ? [mx, my - BEND] : [mx + BEND, my];

  // Arrowhead — pointing along the curve's end tangent toward the target.
  const ang = Math.atan2(head[1] - bend[1], head[0] - bend[0]);
  const ap1: [number, number] = [
    head[0] - HEAD * Math.cos(ang - 0.5),
    head[1] - HEAD * Math.sin(ang - 0.5),
  ];
  const ap2: [number, number] = [
    head[0] - HEAD * Math.cos(ang + 0.5),
    head[1] - HEAD * Math.sin(ang + 0.5),
  ];

  // Arrow draw-on: dash the path and walk the offset to zero.
  const arrowPath = `M ${tail[0]} ${tail[1]} Q ${bend[0]} ${bend[1]} ${head[0]} ${head[1]}`;
  const arrowLen = quadLength(tail, bend, head);
  const drawn = interpolate(local, [3, 16], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1), // EASE.out
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dashOffset = arrowLen * (1 - drawn);
  const headOpacity = interpolate(local, [14, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Caption anchor beside the chip (annotate.mjs offsets).
  const lx =
    side === "left"
      ? tail[0] - 26
      : side === "right"
        ? tail[0] + 26
        : tail[0];
  const ly =
    side === "top"
      ? tail[1] - CAPTION_GAP
      : side === "bottom"
        ? tail[1] + CAPTION_GAP
        : tail[1] + 1;

  // Spring origin = the chip, so the whole annotation grows out of its number.
  const transformOrigin = `${tail[0]}px ${tail[1]}px`;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 1920 1080"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 8000,
        opacity,
      }}
    >
      <g
        style={{
          transform: `translateY(${rise}px) scale(${scale})`,
          transformOrigin,
          transformBox: "view-box",
        }}
      >
        {/* Highlight ring around the target. */}
        <rect
          x={rx - PAD}
          y={ry - PAD}
          width={rw + PAD * 2}
          height={rh + PAD * 2}
          rx={RING_RX}
          fill="none"
          stroke={GM_ELECTRIC}
          strokeWidth={2.5}
          opacity={0.95}
        />

        {/* Curved arrow, drawing on from the chip. */}
        <path
          d={arrowPath}
          fill="none"
          stroke={GM_ELECTRIC}
          strokeWidth={ARROW_W}
          strokeLinecap="round"
          strokeDasharray={arrowLen}
          strokeDashoffset={dashOffset}
        />
        {/* Arrowhead — appears once the line nearly reaches the target. */}
        <polygon
          points={`${head[0]},${head[1]} ${ap1[0]},${ap1[1]} ${ap2[0]},${ap2[1]}`}
          fill={GM_ELECTRIC}
          opacity={headOpacity}
        />

        {/* Numbered chip at the tail. */}
        <circle cx={tail[0]} cy={tail[1]} r={CHIP_R} fill={GM_ELECTRIC} />
        <text
          x={tail[0]}
          y={tail[1] + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={monoFont}
          fontSize={20}
          fontWeight={700}
          fill="#FFFFFF"
        >
          {index}
        </text>

        {/* Caption beside the chip, white-haloed so it reads on any screen. */}
        <text
          x={lx}
          y={ly}
          textAnchor={labelAnchor}
          dominantBaseline="central"
          fontFamily={font}
          fontSize={26}
          fontWeight={600}
          fill="#FFFFFF"
          stroke="rgba(10,15,32,0.85)"
          strokeWidth={5}
          paintOrder="stroke"
          strokeLinejoin="round"
        >
          {label}
        </text>
      </g>
    </svg>
  );
};
