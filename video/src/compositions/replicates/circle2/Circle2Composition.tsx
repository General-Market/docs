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

// Conveyor: horizontal move of "and more" + CIRCLE lockup
// (frames 222→299). Burst → cruise → whip → long settle.
// (The pill wall rides its OWN measured profile — see WALL_OFF.)
const CONV_SHIFTS = [
  59, 83, 82, 79, 73, 67, 60, 54, 48, 43, 38, 34, 30, 27, 24, 21, 19, 16,
  15, 15, 15, 14, 14, 14, 14, 14, 15, 15, 15, 15, 15, 14, 14, 13, 13, 12,
  12, 11, 11, 13, 20, 29, 43, 63, 91, 120, 123, 102, 80, 67, 55, 46, 39,
  33, 29, 25, 22, 19, 17, 15, 13, 12, 10, 9, 8, 7, 6, 5, 4, 4, 3, 3, 2, 2,
  2, 1, 1,
];
const CONV_CUM = cumulative(CONV_SHIFTS);
const CONV_START = 221;

// Wall X offset, measured per frame from the reference (orange-pill
// cx f202-232, grey-stroke cross-correlation f233-260, ~20px/f tail
// while the wall fades out). Index 0 = frame 201.
const WALL_OFF_START = 201;
const WALL_OFF = [
  0, -6, -22, -40, -62, -84, -103.5, -120, -131.5, -135, -137.5, -144.5,
  -158, -178, -206, -243, -290, -350, -424, -513, -618, -736, -863, -994,
  -1122, -1241, -1350, -1447, -1533, -1608, -1674, -1733, -1785, -1831,
  -1871, -1907, -1937, -1963, -1985, -2005, -2025, -2045, -2066, -2087,
  -2109, -2132, -2157, -2184, -2214, -2244, -2274, -2304, -2333, -2361,
  -2388, -2414, -2439, -2463, -2486, -2508, -2528, -2548, -2568, -2588,
  -2608, -2628,
];

// Wall formation: rows expand outward from the crosschain anchor.
// Measured from the blue-row cy per frame (settle 724). Index 0 = f188.
const EXPANSION_START = 188;
const EXPANSION = [
  0, 0.14, 0.377, 0.516, 0.688, 0.794, 0.856, 0.903, 0.94, 0.966, 0.984,
  0.99, 0.995, 0.998, 1,
];

// Grey arrow: measured center per frame (blob track). Index 0 = f122.
// Enters top-right f123, settles at (1005,557) f137-138, S-curve exit
// up-right, fully off screen at f157.
const ARROW_START = 122;
const ARROW_CX = [
  1259, 1247, 1233, 1193.5, 1156.5, 1121.5, 1093, 1070.5, 1051.5, 1037.5,
  1027, 1019, 1013.5, 1009, 1006.5, 1005.5, 1005, 1007.5, 1017, 1033, 1059,
  1097.5, 1151, 1224.5, 1317, 1424.5, 1532, 1629.5, 1712, 1779, 1834, 1879,
  1916, 1945, 1969, 1992,
];
const ARROW_CY = [
  -80, -10, 49.5, 113.5, 182.5, 250.5, 313, 368.5, 415.5, 453.5, 484.5, 509,
  528, 541.5, 550.5, 555.5, 557.5, 556, 552, 544, 532, 514, 488.5, 454.5,
  410.5, 360.5, 309.5, 264, 225, 193.5, 168, 146.5, 130, 115.5, 103, 92,
];

// CIRCLE lockup ride-in. The reference rides in at scale 1.0724 and
// shrinks continuously from f292 (scale) with the Y move starting
// f301 — three measured series, solved from mark cx + word cap height
// (At_x = mark_cx + 586.5*s; settle At = (970, 540), end (970, 264)).
const LOCKUP_DX_START = 262;
const LOCKUP_DX = [
  2600, 2355, 2105, 1860, 1640, 1450, 1284.5, 1072.5, 904.5, 771, 662.5,
  570.5, 493, 426.5, 369, 318.5, 274.5, 236.5, 201.5, 171.5, 144.5, 121,
  101, 83, 67, 53, 41, 31, 23, 17, 11, 7, 4, 2, 1, 0,
];
const LOCKUP_S_START = 291;
const LOCKUP_S = [
  1.0724, 1.0679, 1.0633, 1.0543, 1.0407, 1.0271, 1.0, 0.9683, 0.9186,
  0.8371, 0.7557, 0.706, 0.6606, 0.633, 0.612, 0.597, 0.5875, 0.582,
  0.5806, 0.5806, 0.5806,
];
const LOCKUP_Y_START = 300;
const LOCKUP_Y = [
  540, 535.5, 512, 484.5, 438, 391.5, 360, 329, 312, 296, 286, 277, 271,
  266, 264.5, 264, 264,
];

// Sample a per-frame array (linear between integer frames, clamped).
const sampleSeries = (arr: number[], start: number, frame: number): number => {
  const t = frame - start;
  if (t <= 0) return arr[0];
  if (t >= arr.length - 1) return arr[arr.length - 1];
  const i = Math.floor(t);
  return arr[i] + (arr[i + 1] - arr[i]) * (t - i);
};

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
// Empty pill strokes render at a constant rgb(77,67,98) in the
// reference regardless of the bg gradient — draw them solid.
const EMPTY_STROKE = "rgb(77, 67, 98)";
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
}> = ({ w, h, stops, label, labelWidth, labelSize = 220, stroke = 14, id }) => (
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

// Grey play-arrow — measured ink 132x145, near-sharp corners.
const Arrow: React.FC = () => (
  <svg width={132} height={145} viewBox="0 0 132 145">
    <path
      d="M 1.5 2 L 130.5 72.5 L 1.5 143 Z"
      fill={ARROW_COLOR}
      stroke={ARROW_COLOR}
      strokeWidth={3}
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
      style={{ width: 418, height: 416, transform: "translateX(29px)" }}
    />
  </div>
);

// Full CIRCLE lockup (logo + wordmark) at "big" scale.
// Measured f297: mark ink w403 center-x 383.5, word ink 674-1757
// (cap height 221), word center-x 1215.5.
const LOCKUP_W = 420 + 98 + 1140;
const CircleLockup: React.FC = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 98, width: LOCKUP_W }}>
    <CircleMark />
    <FitText
      text="CIRCLE"
      fontSize={308}
      targetWidth={1140}
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

// Scene-3 footer runs smaller than scene 1 (measured f160: "on" ink
// 602-697, "cronos" ink 754-1305, same center 953.5 / cy 871).
const OnCronosSmall: React.FC = () => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 43 }}>
    <FitText text="on" fontSize={78} targetWidth={105} color={ON_GREY} weight={400} />
    <FitText
      text="cronos"
      fontSize={173}
      targetWidth={566}
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
// Wall of pills — reconstructed from a de-shifted max-composite
// mosaic of ref frames 202-260. Empty rows settle at cy 88 / 414 /
// 722 / 1039 (h 273); labeled pills at 415 / 724 / 1036 (h 272).
// Two waves: e1+e2 appear with the formation (f189-190); everything
// else (incl. the left "N" pills that slide in) pops at f199-200.
// ═════════════════════════════════════════════════════════════════

const WALL_ANCHOR_Y = 415;
type WallPill = {
  x: number; // outer left (settled)
  y: number; // center (settled)
  w: number;
  h: number;
  stops?: [string, string, string];
  label?: string;
  labelWidth?: number;
  wave: 1 | 2;
  slide?: boolean; // left-edge pills slide in from +230
  id: string;
};

const WALL_PILLS: WallPill[] = [
  // row -1 (empties, cy 88)
  { x: -420, y: 88, w: 536, h: 273, wave: 2, slide: true, id: "n1" },
  { x: 147, y: 88, w: 418, h: 273, wave: 1, id: "e1" },
  { x: 590, y: 88, w: 1091, h: 273, wave: 1, id: "e2" },
  { x: 1722, y: 88, w: 493, h: 273, wave: 2, id: "e3" },
  { x: 2260, y: 88, w: 1332, h: 273, wave: 2, id: "e4" },
  { x: 3632, y: 88, w: 1068, h: 273, wave: 2, id: "e5" },
  // row 0 (labeled cy 415, empties cy 414)
  { x: -420, y: 414, w: 578, h: 273, wave: 2, slide: true, id: "n2" },
  { x: 164, y: 415, w: 1592, h: 272, stops: PILL1_STOPS, label: "crosschain liquidity", labelWidth: 1408, wave: 1, id: "p1" },
  { x: 1790, y: 414, w: 1042, h: 273, wave: 2, id: "e6" },
  { x: 2905, y: 414, w: 690, h: 273, wave: 2, id: "e7" },
  { x: 3645, y: 414, w: 1055, h: 273, wave: 2, id: "e8" },
  // row +1 (labeled cy 724, empties cy 722)
  { x: -420, y: 722, w: 578, h: 273, wave: 2, slide: true, id: "n3" },
  { x: 165, y: 724, w: 1200, h: 272, stops: PILL2_STOPS, label: "fully reserved", labelWidth: 1019, wave: 1, id: "p2" },
  { x: 1413, y: 722, w: 812, h: 273, wave: 2, id: "e9" },
  { x: 2275, y: 722, w: 1110, h: 273, wave: 2, id: "e10" },
  { x: 3440, y: 722, w: 1260, h: 273, wave: 2, id: "e11" },
  // row +2 (labeled cy 1036, empties cy 1039)
  { x: -420, y: 1039, w: 578, h: 273, wave: 2, slide: true, id: "n4" },
  { x: 165, y: 1036, w: 1402, h: 272, stops: PILL3_STOPS, label: "24/7 settlement", labelWidth: 1205, wave: 1, id: "p3" },
  { x: 1592, y: 1039, w: 1524, h: 273, wave: 2, id: "e12" },
  { x: 3172, y: 1039, w: 1528, h: 273, wave: 2, id: "e13" },
];

const Wall: React.FC<{
  expansion: number;
  wave1Opacity: number;
  wave2Opacity: number;
  nSlide: number;
}> = ({ expansion, wave1Opacity, wave2Opacity, nSlide }) => (
  <>
    {WALL_PILLS.map((p) => {
      const dy = (p.y - WALL_ANCHOR_Y) * expansion;
      const isLabeled = Boolean(p.label);
      const opacity = isLabeled ? 1 : p.wave === 1 ? wave1Opacity : wave2Opacity;
      if (opacity <= 0) return null;
      return (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: p.x + (p.slide ? nSlide : 0),
            top: WALL_ANCHOR_Y + dy - p.h / 2,
            opacity,
          }}
        >
          <Pill
            w={p.w}
            h={p.h}
            stops={p.stops}
            label={p.label}
            labelWidth={p.labelWidth}
            stroke={isLabeled ? 14 : 12}
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
  const WALL_FORM_START = 189;

  // ── profiles ──
  const t1 = sampleCum(T1_CUM, T1_START, frame); // 0..118
  const t2 = sampleCum(T2_CUM, T2_START, frame); // 0..1028
  const t2v = sampleVel(T2_CUM, T2_START, frame);
  const t3a = sampleCum(T3A_CUM, T3A_START, frame); // 0..536
  const t3av = sampleVel(T3A_CUM, T3A_START, frame);
  const conv = sampleCum(CONV_CUM, CONV_START, frame); // 0..~4574

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
  // Pill descends from the top — center-y measured per frame from the
  // reference (orange blob track, 0-based frames).
  const PILL_DROP_F = [123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138];
  const PILL_DROP_Y = [-136, -93, -29, 39, 107, 170, 226, 272, 312, 342, 366, 386, 399, 408, 413, 415];
  const pillY = interpolate(frame, PILL_DROP_F, PILL_DROP_Y, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // arrow: fully measured path (enters top-right, settles, S-curve exit)
  const arrowX = sampleSeries(ARROW_CX, ARROW_START, frame);
  const arrowY = sampleSeries(ARROW_CY, ARROW_START, frame);
  const showArrow = frame >= 123 && frame < 157;

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
  // Formation expansion + X offset are measured per-frame series.
  const wallExpansion = sampleSeries(EXPANSION, EXPANSION_START, frame);
  // wave 1 = e1/e2 with the formation; wave 2 = the rest, popping at
  // f199-200 (left "N" pills slide in from +230 as they appear).
  const wave1Opacity = interpolate(frame, [WALL_FORM_START, WALL_FORM_START + 1.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wave2Opacity = interpolate(frame, [198, 200], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const nSlide = interpolate(frame, [199, 208], [230, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const wallX = sampleSeries(WALL_OFF, WALL_OFF_START, frame);
  // the wall never leaves — it fades out during the whip (f247-265)
  const wallOpacity = interpolate(frame, [247, 265], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showWall = frame >= WALL_FORM_START && frame < 266;

  // ── conveyor riders ──
  // "and more": ink width 2235, left ink edge at 1801 when conveyor = 0.
  const andMoreX = 1801 - conv;
  const showAndMore = frame >= CONV_START - 3 && andMoreX > -2400;
  // big CIRCLE lockup rides its own measured profile into x 970
  const lockupCX = 970 + sampleSeries(LOCKUP_DX, LOCKUP_DX_START, frame);

  // ── final lockup shrink + cronos + x ──
  const lockupScale = sampleSeries(LOCKUP_S, LOCKUP_S_START, frame);
  const lockupCY = sampleSeries(LOCKUP_Y, LOCKUP_Y_START, frame);
  const showLockup = frame >= 257;

  const cronosOpacity = interpolate(frame, [302, 310], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cronosY = interpolate(frame, [302, 325], [585, 800], {
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
          <OnCronosSmall />
        </At>
      )}

      {/* ═══ Scene 4: pill wall (measured drift, fades out in place) ═══ */}
      {showWall && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateX(${wallX}px)`,
            opacity: wallOpacity,
          }}
        >
          <Wall
            expansion={wallExpansion}
            wave1Opacity={wave1Opacity}
            wave2Opacity={wave2Opacity}
            nSlide={nSlide}
          />
        </div>
      )}

      {/* ═══ Scene 5: giant "and more" (rides conveyor, no blur in ref) ═══ */}
      {showAndMore && (
        <div
          style={{
            position: "absolute",
            left: andMoreX,
            top: 484,
            transform: "translateY(-50%)",
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
        <At x={lockupCX} y={lockupCY} transform={`scale(${lockupScale})`}>
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
            fontSize={281}
            targetWidth={875}
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
