/**
 * IsoBorder — architectural framing for data scenes.
 *
 * Isometric corner brackets and edge lines that wrap the 1920x1080 frame
 * like the bezel of a watch no one can afford. Every angle at 30 degrees,
 * every surface implied by three shades of almost-black.
 *
 * The brackets slide in from the corners. The edge lines connect them
 * with a whisper of white. Tick marks keep time along the border,
 * though what they measure is anyone's guess.
 *
 * Pure SVG. No WebGL, no canvas, no external dependencies.
 * The geometry is honest. The projection is standard isometric:
 * cos(30) = 0.866, sin(30) = 0.5. Everything else is vanity.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

/* ------------------------------------------------------------------ */
/*  Isometric constants                                                */
/* ------------------------------------------------------------------ */

const COS30 = 0.866;
const SIN30 = 0.5;

/** Palette — three faces of darkness, one thread of gold. */
const COLORS = {
  top: "#1a1a1e",
  left: "#111114",
  right: "#151518",
  stroke: "#2a2a30",
  accent: "#c8a24e",
  edgeLine: "rgba(255,255,255,0.03)",
  tick: "rgba(255,255,255,0.06)",
};

/* ------------------------------------------------------------------ */
/*  Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Converts a flat (x, y) coordinate into isometric screen space.
 * z is height off the ground plane.
 */
const isoProject = (
  x: number,
  y: number,
  z: number,
): { sx: number; sy: number } => ({
  sx: (x - y) * COS30,
  sy: (x + y) * SIN30 - z,
});

/**
 * Builds an SVG path for a single isometric box (rectangular prism).
 * Origin is the front-bottom corner in iso space.
 */
const isoBoxPath = (
  ox: number,
  oy: number,
  w: number,
  d: number,
  h: number,
): { top: string; left: string; right: string } => {
  // Six visible corners of the prism (front-right ground is occluded)
  const ftb = isoProject(ox, oy, 0);
  const rbb = isoProject(ox + w, oy + d, 0);
  const fbb = isoProject(ox, oy + d, 0);

  const ftt = isoProject(ox, oy, h);
  const rtt = isoProject(ox + w, oy, h);
  const rbt = isoProject(ox + w, oy + d, h);
  const fbt = isoProject(ox, oy + d, h);

  const p = (pt: { sx: number; sy: number }) => `${pt.sx},${pt.sy}`;

  const top = `M${p(ftt)} L${p(rtt)} L${p(rbt)} L${p(fbt)} Z`;
  const left = `M${p(ftt)} L${p(fbt)} L${p(fbb)} L${p(ftb)} Z`;
  const right = `M${p(fbt)} L${p(rbt)} L${p(rbb)} L${p(fbb)} Z`;

  return { top, left, right };
};

/* ------------------------------------------------------------------ */
/*  IsoCornerBracket                                                   */
/* ------------------------------------------------------------------ */

interface CornerBracketProps {
  /** Which corner: tl, tr, bl, br */
  corner: "tl" | "tr" | "bl" | "br";
  /** Accent color for the inner edge */
  accent: string;
  /** Slide-in progress 0..1 (0 = off-screen, 1 = settled) */
  progress: number;
}

/**
 * L-shaped bracket made of small isometric boxes.
 * Each bracket has a horizontal arm and a vertical arm
 * forming the corner gesture.
 */
const IsoCornerBracket: React.FC<CornerBracketProps> = ({
  corner,
  accent,
  progress,
}) => {
  const boxSize = 6;
  const boxHeight = 4;
  const armLength = 14; // boxes in the long arm
  const stubLength = 4; // boxes in the short perpendicular stub
  const gap = 1.5; // spacing between boxes

  const boxes: Array<{ ox: number; oy: number }> = [];

  // Horizontal arm
  for (let i = 0; i < armLength; i++) {
    boxes.push({ ox: i * (boxSize + gap), oy: 0 });
  }
  // Vertical arm (perpendicular stub at the start)
  for (let j = 1; j <= stubLength; j++) {
    boxes.push({ ox: 0, oy: j * (boxSize + gap) });
  }

  // Determine translation and mirroring per corner
  const armSpan = armLength * (boxSize + gap);
  const stubSpan = (stubLength + 1) * (boxSize + gap);

  // Base positions: place brackets at frame edges with padding
  const pad = 60;
  let tx: number;
  let ty: number;
  let scaleX = 1;
  let scaleY = 1;

  // Slide-in direction offsets
  let slideX = 0;
  let slideY = 0;
  const slideDistance = 120;

  switch (corner) {
    case "tl":
      tx = pad;
      ty = pad;
      slideX = -slideDistance;
      slideY = -slideDistance;
      break;
    case "tr":
      tx = 1920 - pad;
      ty = pad;
      scaleX = -1;
      slideX = slideDistance;
      slideY = -slideDistance;
      break;
    case "bl":
      tx = pad;
      ty = 1080 - pad;
      scaleY = -1;
      slideX = -slideDistance;
      slideY = slideDistance;
      break;
    case "br":
      tx = 1920 - pad;
      ty = 1080 - pad;
      scaleX = -1;
      scaleY = -1;
      slideX = slideDistance;
      slideY = slideDistance;
      break;
  }

  const easedProgress = progress;
  const currentSlideX = slideX * (1 - easedProgress);
  const currentSlideY = slideY * (1 - easedProgress);
  const opacity = progress;

  return (
    <g
      transform={`translate(${tx + currentSlideX}, ${ty + currentSlideY}) scale(${scaleX}, ${scaleY})`}
      opacity={opacity}
    >
      {boxes.map(({ ox, oy }, i) => {
        const paths = isoBoxPath(ox, oy, boxSize, boxSize, boxHeight);
        const isInnerEdge = oy === 0 && ox === 0;

        return (
          <g key={i}>
            <path d={paths.top} fill={COLORS.top} stroke={COLORS.stroke} strokeWidth={0.5} />
            <path d={paths.left} fill={COLORS.left} stroke={COLORS.stroke} strokeWidth={0.5} />
            <path d={paths.right} fill={COLORS.right} stroke={COLORS.stroke} strokeWidth={0.5} />
            {/* Gold accent on the corner box */}
            {isInnerEdge && (
              <path
                d={paths.top}
                fill="none"
                stroke={accent}
                strokeWidth={1.2}
                opacity={0.7}
              />
            )}
          </g>
        );
      })}
      {/* Accent line along the inner edge of the horizontal arm */}
      <line
        x1={isoProject(0, 0, boxHeight).sx}
        y1={isoProject(0, 0, boxHeight).sy}
        x2={isoProject(armSpan - boxSize, 0, boxHeight).sx}
        y2={isoProject(armSpan - boxSize, 0, boxHeight).sy}
        stroke={accent}
        strokeWidth={0.8}
        opacity={0.35}
      />
      {/* Accent line along the inner edge of the vertical arm */}
      <line
        x1={isoProject(0, 0, boxHeight).sx}
        y1={isoProject(0, 0, boxHeight).sy}
        x2={isoProject(0, stubSpan - boxSize, boxHeight).sx}
        y2={isoProject(0, stubSpan - boxSize, boxHeight).sy}
        stroke={accent}
        strokeWidth={0.8}
        opacity={0.35}
      />
    </g>
  );
};

/* ------------------------------------------------------------------ */
/*  IsoEdgeLine                                                        */
/* ------------------------------------------------------------------ */

interface EdgeLineProps {
  /** Start point [x, y] */
  from: [number, number];
  /** End point [x, y] */
  to: [number, number];
  /** Whether to show tick marks */
  ticks?: boolean;
  /** Number of tick marks */
  tickCount?: number;
  /** Fade-in progress 0..1 */
  progress: number;
}

/**
 * Thin connecting line between corner brackets.
 * Almost invisible. Present only to imply continuity
 * between things that do not naturally cohere.
 */
const IsoEdgeLine: React.FC<EdgeLineProps> = ({
  from,
  to,
  ticks = true,
  tickCount = 12,
  progress,
}) => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];

  // Line draws progressively
  const endX = from[0] + dx * progress;
  const endY = from[1] + dy * progress;

  const tickElements: React.ReactNode[] = [];
  if (ticks) {
    for (let i = 1; i < tickCount; i++) {
      const t = i / tickCount;
      if (t > progress) break;
      const tx = from[0] + dx * t;
      const ty = from[1] + dy * t;
      // Perpendicular tick: short vertical line
      const tickLen = 4;
      tickElements.push(
        <line
          key={i}
          x1={tx}
          y1={ty - tickLen / 2}
          x2={tx}
          y2={ty + tickLen / 2}
          stroke={COLORS.tick}
          strokeWidth={0.5}
        />,
      );
    }
  }

  return (
    <g opacity={progress > 0 ? 1 : 0}>
      <line
        x1={from[0]}
        y1={from[1]}
        x2={endX}
        y2={endY}
        stroke={COLORS.edgeLine}
        strokeWidth={1}
      />
      {tickElements}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/*  IsoSceneBorder — the full frame                                    */
/* ------------------------------------------------------------------ */

export interface IsoSceneBorderProps {
  /** Accent color for inner edges (default gold #c8a24e) */
  accent?: string;
  /** Whether to animate entrance (default true) */
  animate?: boolean;
  /** Animation delay in frames (default 0) */
  delay?: number;
}

/**
 * Four corners, four edges. A frame for things that deserve framing,
 * which is to say: data that would otherwise float in the void
 * like all unframed things do — without consequence.
 */
export const IsoSceneBorder: React.FC<IsoSceneBorderProps> = ({
  accent = COLORS.accent,
  animate = true,
  delay = 0,
}) => {
  const frame = useCurrentFrame();

  // Bracket entrance: 15 frames with ease-out
  const bracketDuration = 15;
  const rawBracketProgress = animate
    ? interpolate(frame - delay, [0, bracketDuration], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  // Cubic ease-out for that architectural settling feel
  const bracketProgress =
    1 - Math.pow(1 - rawBracketProgress, 3);

  // Edge lines fade in slightly after brackets begin
  const edgeDelay = animate ? 6 : 0;
  const edgeDuration = 20;
  const rawEdgeProgress = animate
    ? interpolate(frame - delay - edgeDelay, [0, edgeDuration], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  const edgeProgress = 1 - Math.pow(1 - rawEdgeProgress, 2);

  // Edge line coordinates — connecting bracket endpoints
  // These sit just inside the bracket arms
  const pad = 60;
  const inset = 14; // offset from the literal edge
  const topY = pad + inset;
  const bottomY = 1080 - pad - inset;
  const leftX = pad + inset;
  const rightX = 1920 - pad - inset;

  // Horizontal edges run along the bracket arm direction
  const bracketArmPx = 14 * (6 + 1.5); // armLength * (boxSize + gap)
  const topFromX = leftX + bracketArmPx;
  const topToX = rightX - bracketArmPx;
  const leftFromY = topY + 4 * (6 + 1.5); // stubLength * (boxSize + gap)
  const leftToY = bottomY - 4 * (6 + 1.5);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100 }}>
      <svg
        viewBox="0 0 1920 1080"
        width={1920}
        height={1080}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Corner brackets */}
        <IsoCornerBracket
          corner="tl"
          accent={accent}
          progress={bracketProgress}
        />
        <IsoCornerBracket
          corner="tr"
          accent={accent}
          progress={bracketProgress}
        />
        <IsoCornerBracket
          corner="bl"
          accent={accent}
          progress={bracketProgress}
        />
        <IsoCornerBracket
          corner="br"
          accent={accent}
          progress={bracketProgress}
        />

        {/* Horizontal edge lines — top and bottom */}
        <IsoEdgeLine
          from={[topFromX, topY]}
          to={[topToX, topY]}
          ticks
          tickCount={16}
          progress={edgeProgress}
        />
        <IsoEdgeLine
          from={[topFromX, bottomY]}
          to={[topToX, bottomY]}
          ticks
          tickCount={16}
          progress={edgeProgress}
        />

        {/* Vertical edge lines — left and right */}
        <IsoEdgeLine
          from={[leftX, leftFromY]}
          to={[leftX, leftToY]}
          ticks
          tickCount={10}
          progress={edgeProgress}
        />
        <IsoEdgeLine
          from={[rightX, leftFromY]}
          to={[rightX, leftToY]}
          ticks
          tickCount={10}
          progress={edgeProgress}
        />
      </svg>
    </AbsoluteFill>
  );
};
