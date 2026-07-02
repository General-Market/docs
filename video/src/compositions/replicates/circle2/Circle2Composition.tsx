import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, Easing } from "remotion";
import { measureText } from "@remotion/layout-utils";
import { loadFont as loadDMSans } from "@remotion/google-fonts/DMSans";
import { loadFont as loadVarela } from "@remotion/google-fonts/VarelaRound";

export const FPS = 30;
export const DURATION = 404; // 13.45s — matches reference circle2-original.mp4

const { fontFamily: DM_SANS } = loadDMSans("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "700"],
});
const { fontFamily: VARELA } = loadVarela("normal", {
  subsets: ["latin"],
  weights: ["400"],
});

// ═════════════════════════════════════════════════════════════════
// Measured motion profiles — frame-by-frame optical shift of the
// reference (row/column luminance cross-correlation at 960x540, ×2
// → full-res px), validated against track-v3 OCR positions.
// ═════════════════════════════════════════════════════════════════

const cumulative = (shifts: number[]): number[] => {
  const out: number[] = [0];
  let acc = 0;
  for (const s of shifts) {
    acc += s * 2; // measured at half-res
    out.push(acc);
  }
  return out;
};

// T1: title rises 118px (frames 27→47). Pure ease-out decay.
const T1_SHIFTS = [11, 7, 5, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1];
const T1_CUM = cumulative(T1_SHIFTS);
const T1_START = 26;
const T1_TOTAL = T1_CUM[T1_CUM.length - 1]; // 118

// T2: unified vertical conveyor, ~1028px (frames 58→83).
// Fast attack, long exponential settle.
const T2_SHIFTS = [
  15, 19, 23, 30, 41, 58, 100, 62, 37, 26, 21, 18, 12, 10, 8, 7, 6, 5, 4, 3,
  3, 2, 2, 1, 1,
];
const T2_CUM = cumulative(T2_SHIFTS);
const T2_START = 57;
const T2_TOTAL = T2_CUM[T2_CUM.length - 1]; // 1028

// T3a: "Now available" accelerates up and out (frames 98→117). Ease-in.
const T3A_SHIFTS = [3, 3, 3, 4, 5, 5, 6, 7, 8, 10, 11, 13, 15, 18, 21, 25, 31, 39, 41];
const T3A_CUM = cumulative(T3A_SHIFTS);
const T3A_START = 97;

// Conveyor: horizontal move of "and more" + CIRCLE lockup + wall
// (frames 222→299). Burst → cruise → whip → long settle.
const CONV_SHIFTS = [
  59, 83, 82, 79, 73, 67, 60, 54, 48, 43, 38, 34, 30, 27, 24, 21, 19, 16,
  15, 15, 15, 14, 14, 14, 14, 14, 15, 15, 15, 15, 15, 14, 14, 13, 13, 12,
  12, 11, 11, 13, 20, 29, 43, 63, 91, 120, 123, 102, 80, 67, 55, 46, 39,
  33, 29, 25, 22, 19, 17, 15, 13, 12, 10, 9, 8, 7, 6, 5, 4, 4, 3, 3, 2, 2,
  2, 1, 1,
];
const CONV_CUM = cumulative(CONV_SHIFTS);
const CONV_START = 221;

// Sample a cumulative profile at a (fractional) frame.
const sampleCum = (cum: number[], start: number, frame: number): number => {
  const t = frame - start;
  if (t <= 0) return 0;
  if (t >= cum.length - 1) return cum[cum.length - 1];
  const i = Math.floor(t);
  const f = t - i;
  return cum[i] + (cum[i + 1] - cum[i]) * f;
};

// Velocity (px/frame) of a profile — drives motion skew + blur.
const sampleVel = (cum: number[], start: number, frame: number): number =>
  sampleCum(cum, start, frame + 0.5) - sampleCum(cum, start, frame - 0.5);

// ═════════════════════════════════════════════════════════════════
// Palette (sampled from reference frames)
// ═════════════════════════════════════════════════════════════════

const BG_TOP = "#08001C";
const BG_BOTTOM = "#251543";

const TITLE_STOPS: [string, string, string] = ["#B6CCF6", "#ADB3F2", "#CDBEF2"];
const PILL1_STOPS: [string, string, string] = ["#F4C97E", "#EE9D76", "#EE6F63"]; // crosschain
const PILL2_STOPS: [string, string, string] = ["#3FA0F2", "#6E90EB", "#AB82E8"]; // fully reserved
const PILL3_STOPS: [string, string, string] = ["#DC5589", "#DA61B1", "#E077EB"]; // 24/7 settlement
const EMPTY_STROKE = "rgba(122, 110, 150, 0.42)";
const ARROW_COLOR = "#89819A";
const ON_GREY = "#E1DAEA";
const WHITE = "#F7F6F8";

const gradOf = (stops: [string, string, string]) =>
  `linear-gradient(90deg, ${stops[0]} 0%, ${stops[1]} 50%, ${stops[2]} 100%)`;

// ═════════════════════════════════════════════════════════════════
// Building blocks
// ═════════════════════════════════════════════════════════════════

const Bg: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG_TOP} 0%, #120829 45%, ${BG_BOTTOM} 100%)` }}>
      {/* animated film grain, very subtle */}
      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0, opacity: 0.028 }}>
        <filter id="c2grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 24} stitchTiles="stitch" />
        </filter>
        <rect width="1920" height="1080" filter="url(#c2grain)" />
      </svg>
    </AbsoluteFill>
  );
};

// Text whose ink is scaled horizontally to hit the measured reference
// width exactly (house pattern, see circle1 replica).
const FitText: React.FC<{
  text: string;
  fontSize: number;
  targetWidth: number;
  gradient?: [string, string, string];
  color?: string;
  weight?: number;
  letterSpacing?: string;
  font?: string;
}> = ({ text, fontSize, targetWidth, gradient, color, weight = 500, letterSpacing = "0em", font = DM_SANS }) => {
  const natural = measureText({
    text,
    fontFamily: font,
    fontSize,
    fontWeight: String(weight),
    letterSpacing,
  }).width;
  const scaleX = natural > 0 ? targetWidth / natural : 1;
  const style: React.CSSProperties = {
    fontFamily: font,
    fontSize,
    fontWeight: weight,
    letterSpacing,
    whiteSpace: "nowrap",
    lineHeight: 1,
    transform: `scaleX(${scaleX})`,
    transformOrigin: "center",
  };
  if (gradient) {
    style.backgroundImage = gradOf(gradient);
    style.WebkitBackgroundClip = "text";
    style.backgroundClip = "text";
    style.color = "transparent";
  } else {
    style.color = color ?? WHITE;
  }
  return (
    <div
      style={{
        width: targetWidth,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <span style={style}>{text}</span>
    </div>
  );
};

// Centered absolutely-positioned wrapper
const At: React.FC<{
  x: number;
  y: number;
  children: React.ReactNode;
  opacity?: number;
  transform?: string;
  filter?: string;
}> = ({ x, y, children, opacity = 1, transform = "", filter }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: `translate(-50%, -50%) ${transform}`,
      opacity,
      filter,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {children}
  </div>
);

// Outlined capsule pill, optional gradient label (label centered)
const Pill: React.FC<{
  w: number;
  h: number;
  stops?: [string, string, string];
  label?: string;
  labelWidth?: number;
  labelSize?: number;
  stroke?: number;
  id: string;
}> = ({ w, h, stops, label, labelWidth, labelSize = 220, stroke = 5, id }) => (
  <div style={{ position: "relative", width: w, height: h }}>
    <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
      {stops ? (
        <defs>
          <linearGradient id={`pg-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={stops[0]} />
            <stop offset="50%" stopColor={stops[1]} />
            <stop offset="100%" stopColor={stops[2]} />
          </linearGradient>
        </defs>
      ) : null}
      <rect
        x={stroke / 2}
        y={stroke / 2}
        width={w - stroke}
        height={h - stroke}
        rx={(h - stroke) / 2}
        fill="none"
        stroke={stops ? `url(#pg-${id})` : EMPTY_STROKE}
        strokeWidth={stroke}
      />
    </svg>
    {label && labelWidth ? (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <FitText
          text={label}
          fontSize={labelSize}
          targetWidth={labelWidth}
          gradient={stops}
          weight={500}
        />
      </div>
    ) : null}
  </div>
);

// Grey play-arrow (rounded triangle)
const Arrow: React.FC<{ size?: number }> = ({ size = 130 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path
      d="M 22 12 L 88 50 L 22 88 Z"
      fill={ARROW_COLOR}
      stroke={ARROW_COLOR}
      strokeWidth={10}
      strokeLinejoin="round"
    />
  </svg>
);

// Circle brand mark — raster extracted from reference frame 298 (the
// full-size, unoccluded lockup): crop x[202,605) y[338,740), ink
// 391x390, alpha-matted off the dark bg. Shown at natural size inside
// the 420 slot, so the shrink only ever scales it DOWN.
const CircleMark: React.FC = () => (
  <div
    style={{
      width: 420,
      height: 420,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Img
      src={staticFile("circle2-assets/circle-mark.png")}
      style={{ width: 403, height: 402 }}
    />
  </div>
);

// Full CIRCLE lockup (logo + wordmark) at "big" scale.
// Measured big: logo Ø420 center (360,540), word cap 206 center-x 1235.
const LOCKUP_W = 420 + 98 + 1134;
const CircleLockup: React.FC = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 98, width: LOCKUP_W }}>
    <CircleMark />
    <FitText
      text="CIRCLE"
      fontSize={295}
      targetWidth={1134}
      color={WHITE}
      weight={500}
      letterSpacing="0.09em"
    />
  </div>
);

// Thin white ×
const XMark: React.FC<{ size?: number; rotation?: number }> = ({
  size = 58,
  rotation = 0,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 60 60"
    style={{ transform: `rotate(${rotation}deg)` }}
  >
    <g stroke={WHITE} strokeWidth={4.5} strokeLinecap="round">
      <line x1="8" y1="8" x2="52" y2="52" />
      <line x1="52" y1="8" x2="8" y2="52" />
    </g>
  </svg>
);

// "on cronos" footer — measured: "on" ink 563-690, "cronos" ink 757-1345.
const OnCronos: React.FC = () => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 67 }}>
    <FitText text="on" fontSize={104} targetWidth={140} color={ON_GREY} weight={400} />
    <FitText
      text="cronos"
      fontSize={185}
      targetWidth={605}
      color={WHITE}
      weight={400}
      font={VARELA}
      letterSpacing="-0.01em"
    />
  </div>
);

// motion skew: lean while moving vertically (measured in reference)
const skewOf = (vel: number): string => {
  const deg = Math.max(-14, Math.min(14, -vel * 0.065));
  return `skewX(${deg}deg)`;
};
const blurOf = (vel: number): string | undefined => {
  const b = Math.min(Math.abs(vel) * 0.028, 5);
  return b > 0.4 ? `blur(${b.toFixed(2)}px)` : undefined;
};

// ═════════════════════════════════════════════════════════════════
// Wall of pills. Row centers (settled): 105 / 415 / 724 / 1036.
// Rows expand outward from the crosschain row during formation.
// ═════════════════════════════════════════════════════════════════

const WALL_ANCHOR_Y = 415;
type WallPill = {
  x: number; // left
  y: number; // center (settled)
  w: number;
  h: number;
  stops?: [string, string, string];
  label?: string;
  labelWidth?: number;
  id: string;
};

const WALL_PILLS: WallPill[] = [
  // row -1 (empties, y 115)
  { x: 150, y: 105, w: 410, h: 268, id: "e1" },
  { x: 592, y: 105, w: 1088, h: 268, id: "e2" },
  { x: 1732, y: 105, w: 720, h: 268, id: "e3" },
  { x: 2504, y: 105, w: 700, h: 268, id: "e11" },
  // row 0 (y 415)
  { x: 164, y: 415, w: 1592, h: 272, stops: PILL1_STOPS, label: "crosschain liquidity", labelWidth: 1440, id: "p1" },
  { x: 1800, y: 415, w: 760, h: 256, id: "e4" },
  { x: 2612, y: 415, w: 640, h: 256, id: "e12" },
  // row +1 (y 733)
  { x: 165, y: 724, w: 1200, h: 272, stops: PILL2_STOPS, label: "fully reserved", labelWidth: 1042, id: "p2" },
  { x: 1417, y: 724, w: 760, h: 256, id: "e5" },
  { x: 2229, y: 724, w: 520, h: 256, id: "e6" },
  { x: 2801, y: 724, w: 500, h: 256, id: "e13" },
  // row +2 (y 1010)
  { x: 165, y: 1036, w: 1402, h: 272, stops: PILL3_STOPS, label: "24/7 settlement", labelWidth: 1232, id: "p3" },
  { x: 1619, y: 1036, w: 760, h: 256, id: "e7" },
  { x: 2431, y: 1036, w: 820, h: 256, id: "e14" },
];

const Wall: React.FC<{ expansion: number; emptyOpacity: number }> = ({
  expansion,
  emptyOpacity,
}) => (
  <>
    {WALL_PILLS.map((p) => {
      const dy = (p.y - WALL_ANCHOR_Y) * expansion;
      const isLabeled = Boolean(p.label);
      return (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: p.x,
            top: WALL_ANCHOR_Y + dy - p.h / 2,
            opacity: isLabeled ? 1 : emptyOpacity,
          }}
        >
          <Pill
            w={p.w}
            h={p.h}
            stops={p.stops}
            label={p.label}
            labelWidth={p.labelWidth}
            stroke={5}
            id={`wall-${p.id}`}
          />
        </div>
      );
    })}
  </>
);

// ═════════════════════════════════════════════════════════════════
// Main composition
// ═════════════════════════════════════════════════════════════════

export const Circle2Composition: React.FC = () => {
  const frame = useCurrentFrame();

  // ── phase boundaries ──
  const T2_END = 83;
  const T3B_START = 115;
  const CRONOS2_FADE_START = 175;
  const WALL_FORM_START = 187;
  const WALL_FORM_END = 200;
  const SHRINK_START = 298;
  const SHRINK_END = 310;

  // ── profiles ──
  const t1 = sampleCum(T1_CUM, T1_START, frame); // 0..118
  const t2 = sampleCum(T2_CUM, T2_START, frame); // 0..1028
  const t2v = sampleVel(T2_CUM, T2_START, frame);
  const t3a = sampleCum(T3A_CUM, T3A_START, frame); // 0..536
  const t3av = sampleVel(T3A_CUM, T3A_START, frame);
  const conv = sampleCum(CONV_CUM, CONV_START, frame); // 0..~4574
  const convV = sampleVel(CONV_CUM, CONV_START, frame);

  // ── scene 1: title + on cronos ──
  // Title: slow drift 586→555 (f0-26), then T1 rise 555→437.
  const drift = interpolate(frame, [0, T1_START - 1], [0, 31], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = 578 - drift - t1 - t2;
  const titleProgress = (drift + t1) / (31 + T1_TOTAL);
  const titleScale = 1.066 - 0.066 * titleProgress;
  const onCronosOpacity1 = interpolate(frame, [28, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  // cronos footer rises 1000→866 with a long ease-out tail (track-v3)
  const onCronosRise1 = interpolate(frame, [28, 66], [134, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const onCronosY1 = 850 + onCronosRise1 - t2;
  const showScene1 = frame < T2_END + 6;

  // ── scene 2: Now available (hold center-y 500) ──
  const nowY = 505 + T2_TOTAL - t2 - t3a;
  const nowVel = t2v + t3av;
  const showNow = frame >= T2_START && frame < 119;

  // ── scene 3: pill + arrow + on cronos ──
  // Pill descends from the top — trajectory measured frame-by-frame
  // from the reference (pixel band scan, 0-based frames).
  const PILL_DROP_F = [119, 124, 127, 130, 133, 136, 140];
  const PILL_DROP_Y = [-240, -93, 107, 272, 366, 408, 415];
  const pillY = interpolate(frame, PILL_DROP_F, PILL_DROP_Y, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // arrow rides in phase with the pill, pinned 143px below its center
  // through the drop (measured f124/127/130/133/136: offset 143±1),
  // then relaxes to the 105 rest offset as the pill settles.
  const arrowPillY = pillY;
  const arrowOffset = interpolate(frame, [136, 140], [143, 105], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // arrow exit: flies up-right off screen
  const arrowExit = interpolate(frame, [142, 154], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });
  const arrowX = 1062 + 1040 * arrowExit;
  const arrowY = arrowPillY + arrowOffset - 700 * arrowExit;
  const showArrow = frame >= T3B_START && frame < 155;

  // cronos footer #2: rises from below the frame, settles at 866,
  // then slides back down and fades before the wall forms.
  const onCronosRise2 = interpolate(frame, [116, 144], [254, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const onCronosExit2 = interpolate(frame, [CRONOS2_FADE_START, 187], [0, 114], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });
  const onCronosY2 = 861 + onCronosRise2 + onCronosExit2;
  const onCronosOpacity2 = interpolate(frame, [177, 187], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showSoloPill = frame >= T3B_START && frame < WALL_FORM_START;
  const showOnCronos2 = frame >= 116 && frame < 187;

  // ── wall ──
  const wallExpansion = interpolate(frame, [WALL_FORM_START, WALL_FORM_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const emptyOpacity = interpolate(frame, [WALL_FORM_START + 1, WALL_FORM_END - 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // wall pre-drift left before the main conveyor grabs it:
  // ~13px/f immediately (track-v3: crosschain cx 962→855 by f207,
  // →729 by f216), then accelerating into the conveyor handoff.
  const preDrift =
    interpolate(frame, [201, 209], [0, -132], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.quad),
    }) +
    interpolate(frame, [209, 215], [0, -101], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) +
    interpolate(frame, [215, CONV_START], [0, -227], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.quad),
    });
  const wallX = preDrift - conv;
  const showWall = frame >= WALL_FORM_START && wallX > -3600;

  // ── conveyor riders ──
  // "and more": ink width 2235, left ink edge at 1801 when conveyor = 0.
  const andMoreX = 1801 - conv;
  const showAndMore = frame >= CONV_START - 3 && andMoreX > -2400;
  // big CIRCLE lockup settles centered at x 969
  const lockupCX = 969 + (CONV_CUM[CONV_CUM.length - 1] - conv);

  // ── final lockup shrink + cronos + x ──
  const shrinkP = interpolate(frame, [SHRINK_START, SHRINK_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const lockupScale = 1 - (1 - 0.557) * shrinkP;
  const lockupCY = 540 - (540 - 264) * shrinkP;
  const showLockup = frame >= 257;

  const cronosOpacity = interpolate(frame, [302, 310], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cronosY = interpolate(frame, [302, 325], [600, 815], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.7, 0.25, 1),
  });
  const cronosScale = interpolate(frame, [302, 325], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const showCronosFinal = frame >= 302;

  const xOpacity = interpolate(frame, [304, 315], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const xRotation = interpolate(frame, [304, 317], [-75, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const showX = frame >= 304;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Bg />

      {/* ═══ Scene 1: USDC, EURC, & CCTP (+ on cronos) ═══ */}
      {showScene1 && (
        <>
          <At x={963} y={titleY} transform={`scale(${titleScale}) ${skewOf(t2v)}`} filter={blurOf(t2v)}>
            <FitText
              text="USDC, EURC, & CCTP"
              fontSize={180}
              targetWidth={1596}
              gradient={TITLE_STOPS}
              weight={500}
              letterSpacing="-0.01em"
            />
          </At>
          {frame >= 28 && (
            <At x={950} y={onCronosY1} opacity={onCronosOpacity1} transform={skewOf(t2v)} filter={blurOf(t2v)}>
              <OnCronos />
            </At>
          )}
        </>
      )}

      {/* ═══ Scene 2: Now available ═══ */}
      {showNow && (
        <At x={967} y={nowY} transform={skewOf(nowVel)} filter={blurOf(nowVel)}>
          <FitText
            text="Now available"
            fontSize={300}
            targetWidth={1672}
            gradient={TITLE_STOPS}
            weight={500}
            letterSpacing="-0.01em"
          />
        </At>
      )}

      {/* ═══ Scene 3: crosschain liquidity pill + arrow + on cronos ═══ */}
      {showSoloPill && (
        <At x={960} y={pillY}>
          <Pill
            w={1592}
            h={272}
            stops={PILL1_STOPS}
            label="crosschain liquidity"
            labelWidth={1440}
            id="solo"
          />
        </At>
      )}
      {showArrow && (
        <At x={arrowX} y={arrowY}>
          <Arrow />
        </At>
      )}
      {showOnCronos2 && (
        <At x={954} y={onCronosY2} opacity={onCronosOpacity2}>
          <OnCronos />
        </At>
      )}

      {/* ═══ Scene 4: pill wall (pre-drifts, then rides conveyor) ═══ */}
      {showWall && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateX(${wallX}px)`,
          }}
        >
          <Wall expansion={wallExpansion} emptyOpacity={emptyOpacity} />
        </div>
      )}

      {/* ═══ Scene 5: giant "and more" (rides conveyor) ═══ */}
      {showAndMore && (
        <div
          style={{
            position: "absolute",
            left: andMoreX,
            top: 484,
            transform: "translateY(-50%)",
            filter: blurOf(convV),
          }}
        >
          <FitText
            text="and more"
            fontSize={605}
            targetWidth={2235}
            color={WHITE}
            weight={500}
            letterSpacing="-0.01em"
          />
        </div>
      )}

      {/* ═══ Scene 6: CIRCLE lockup (rides conveyor, then shrinks up) ═══ */}
      {showLockup && (
        <At
          x={frame < SHRINK_START ? lockupCX : 970}
          y={lockupCY}
          transform={`scale(${lockupScale})`}
          filter={frame < SHRINK_START ? blurOf(convV) : undefined}
        >
          <CircleLockup />
        </At>
      )}

      {/* ═══ Scene 7: × + cronos ═══ */}
      {showX && (
        <At x={960} y={540} opacity={xOpacity}>
          <XMark rotation={xRotation} />
        </At>
      )}
      {showCronosFinal && (
        <At x={969} y={cronosY} opacity={cronosOpacity} transform={`scale(${cronosScale})`}>
          <FitText
            text="cronos"
            fontSize={302}
            targetWidth={851}
            color={WHITE}
            weight={400}
            font={VARELA}
            letterSpacing="-0.01em"
          />
        </At>
      )}
    </AbsoluteFill>
  );
};

export const circle2ReplicateMeta = {
  id: "Circle2-Replicate",
  component: Circle2Composition,
  width: 1920,
  height: 1080,
  fps: FPS,
  durationInFrames: DURATION,
};
