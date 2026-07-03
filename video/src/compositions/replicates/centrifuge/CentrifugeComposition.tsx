import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import {
  PathAsset,
  logoCentrifuge,
  logoNyl,
  tokW0,
  tokW1,
  firstW0,
  firstW1,
  firstW2,
  ushy1W0,
  ushy1W1,
  ushy1W2,
  ushy2W0,
  ushy2W1,
  ushy2W2,
  hybText,
  instText,
  onchainText,
} from "./paths";

// Centrifuge × New York Life "Tokenization partnership" announcement replica.
// Source: 1280x720 @ 60fps, 1200 frames. All keyframes are measured from the
// reference (per-frame OpenCV bounding boxes / edge tracks). Every visual
// asset is rebuilt: logos & headlines as traced vector paths, background as
// procedural gradients/lines — no raster cutouts.

export const FPS = 60;
export const DURATION = 1200;
const W = 1280;
const H = 720;

const BG = "#F7C418";
const FACE = "#0B67F5";
const STRIP = "#B4D0FD";
const CAP = "#0A50D8";
const CARD_FILL = "#FDFDFD";
const CARD_BORDER = "rgba(62, 72, 132, 0.62)";
const INK = "#244EE6"; // headlines, card copy, Centrifuge logo
const NYL_SQUARE = "#1266EE";
const NYL_WORDMARK = "#2564D6";

const kf = (
  frame: number,
  frames: number[],
  values: number[],
  easing?: (t: number) => number,
) =>
  interpolate(frame, frames, values, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

const easeOut = Easing.out(Easing.cubic);

// ------------------------------------------------------------- vector art

const Vec: React.FC<{
  p: PathAsset;
  x: number;
  y: number;
  w: number;
  h: number;
  o?: number;
  fill?: string;
}> = ({ p, x, y, w, h, o = 1, fill = INK }) => {
  if (o <= 0) return null;
  return (
    <svg
      viewBox={`0 0 ${p.vw} ${p.vh}`}
      style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: o }}
    >
      <g transform={p.tf}>
        <path d={p.d} fill={fill} />
      </g>
    </svg>
  );
};

// NYL lockup: square mark and serif wordmark carry different blues — one
// traced path, two clipped fills (split at viewBox x=300, inside the gap).
const NylVec: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg viewBox={`0 0 ${logoNyl.vw} ${logoNyl.vh}`} style={{ width: w, height: h }}>
      <defs>
        <clipPath id={`sq${uid}`}>
          <rect x={0} y={0} width={300} height={logoNyl.vh} />
        </clipPath>
        <clipPath id={`wm${uid}`}>
          <rect x={300} y={0} width={logoNyl.vw - 300} height={logoNyl.vh} />
        </clipPath>
      </defs>
      <g clipPath={`url(#sq${uid})`}>
        <g transform={logoNyl.tf}>
          <path d={logoNyl.d} fill={NYL_SQUARE} />
        </g>
      </g>
      <g clipPath={`url(#wm${uid})`}>
        <g transform={logoNyl.tf}>
          <path d={logoNyl.d} fill={NYL_WORDMARK} />
        </g>
      </g>
    </svg>
  );
};

const LOGO_RATIO = 0.695; // logo width / card width, measured at lockup
const AR_CF = 102 / 339;
const AR_NYL = 108 / 337;

const CfLogo: React.FC<{ cardW: number }> = ({ cardW }) => {
  const w = cardW * LOGO_RATIO;
  return (
    <svg viewBox={`0 0 ${logoCentrifuge.vw} ${logoCentrifuge.vh}`} style={{ width: w, height: w * AR_CF }}>
      <g transform={logoCentrifuge.tf}>
        <path d={logoCentrifuge.d} fill={INK} />
      </g>
    </svg>
  );
};
const NylLogo: React.FC<{ cardW: number }> = ({ cardW }) => {
  const w = cardW * LOGO_RATIO;
  return <NylVec w={w} h={w * AR_NYL} />;
};

// ---------------------------------------------------------------- ribbons

type RibbonProps = {
  b: number; // face-top y at screen x=640
  slope: number;
  faceH: number;
  stripH?: number;
  stripSide?: "above" | "below";
  opacity?: number;
  growW?: number; // 0..3400 while growing; undefined = full
  sheen?: boolean;
  faceColor?: string;
  stripColor?: string;
};

const Ribbon: React.FC<RibbonProps> = ({
  b,
  slope,
  faceH,
  stripH = 0,
  stripSide = "below",
  opacity = 1,
  growW,
  sheen = false,
  faceColor = FACE,
  stripColor = STRIP,
}) => {
  if (opacity <= 0) return null;
  const deg = (Math.atan(slope) * 180) / Math.PI;
  const totalH = faceH + stripH;
  const stripFirst = stripSide === "above";
  const w = growW === undefined ? 3400 : Math.max(0, growW);
  const growing = growW !== undefined && growW < 3400;
  return (
    <div
      style={{
        position: "absolute",
        left: 640 - 1700,
        top: b - (stripFirst ? stripH : 0),
        width: 3400,
        height: totalH,
        transform: `rotate(${deg}deg)`,
        transformOrigin: "1700px 0px",
        opacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: w,
          height: totalH,
          overflow: "hidden",
        }}
      >
        {stripFirst ? (
          <>
            <div style={{ height: stripH, background: stripColor }} />
            <div style={{ height: faceH, background: faceColor }} />
          </>
        ) : (
          <>
            <div style={{ height: faceH, background: faceColor }} />
            <div style={{ height: stripH, background: stripColor }} />
          </>
        )}
        {sheen && stripH > 0 ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: stripFirst ? 0 : faceH,
              width: "100%",
              height: stripH,
              background:
                "linear-gradient(90deg, rgba(255,255,255,0) 20%, rgba(255,255,255,0.75) 52%, rgba(255,255,255,0) 80%)",
            }}
          />
        ) : null}
        {growing ? (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: 26,
              height: totalH,
              background: CAP,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ coins

const Coin: React.FC<{ x: number; y: number; d: number; o?: number }> = ({
  x,
  y,
  d,
  o = 1,
}) => {
  if (o <= 0) return null;
  const rim = d * 0.09;
  return (
    <div
      style={{
        position: "absolute",
        left: x - d / 2 - rim,
        top: y - d / 2,
        width: d + rim,
        height: d,
        opacity: o,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: d,
          height: d,
          borderRadius: "50%",
          background:
            "linear-gradient(210deg, #FAF0C4 12%, #DCE0CC 50%, #C8DBF2 90%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: rim,
          top: 0,
          width: d,
          height: d,
          borderRadius: "50%",
          background:
            "linear-gradient(215deg, #F5C520 16%, #E8BE28 38%, #ABA662 60%, #84989F 82%, #7C90A8 100%)",
          boxShadow: "inset 0 0 0 1.5px rgba(252,246,214,0.5)",
        }}
      />
    </div>
  );
};

// ------------------------------------------------------------------ cards

const Sweep: React.FC<{ t: number }> = ({ t }) => {
  if (t <= 0 || t >= 1) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        borderRadius: "inherit",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-40%",
          height: "180%",
          width: "78%",
          left: `${-60 + t * 170}%`,
          transform: "rotate(18deg)",
          background:
            "linear-gradient(90deg, rgba(250,236,190,0) 0%, rgba(250,236,190,0.4) 50%, rgba(250,236,190,0) 100%)",
        }}
      />
    </div>
  );
};

type CardProps = {
  cx: number;
  cy: number;
  w: number;
  h: number;
  o?: number;
  sweepT?: number;
  children?: React.ReactNode;
};

const Card: React.FC<CardProps> = ({ cx, cy, w, h, o = 1, sweepT = 0, children }) => {
  if (o <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: cx - w / 2,
        top: cy - h / 2,
        width: w,
        height: h,
        background: CARD_FILL,
        border: `1.5px solid ${CARD_BORDER}`,
        borderRadius: 13,
        opacity: o,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
      <Sweep t={sweepT} />
    </div>
  );
};

// ------------------------------------------------------------- background

// Pinstripes: 10 thin white lines, slope 0.576, intercept -615 + 140k.
const PIN_BS = Array.from({ length: 11 }, (_, k) => -615 + 140 * k);

const Pinstripes: React.FC = () => (
  <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
    {PIN_BS.map((b) => (
      <line
        key={b}
        x1={-40}
        y1={b - 0.576 * 40}
        x2={1320}
        y2={b + 0.576 * 1320}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={2.2}
      />
    ))}
  </svg>
);

// Rays: gradient wedges between pinstripe lines — alpha ramps linearly from 0
// at the upper pin edge to `amp` at the lower pin edge, hard cut across it.
// Zone amplitudes measured from the reference overlay.
const RAY_DEG = (Math.atan(0.576) * 180) / Math.PI;
const RayWedge: React.FC<{ b0: number; b1: number; amp: number }> = ({ b0, b1, amp }) => (
  <div
    style={{
      position: "absolute",
      left: 640 - 1700,
      top: b0,
      width: 3400,
      height: b1 - b0,
      transform: `rotate(${RAY_DEG}deg)`,
      transformOrigin: "1700px 0px",
      background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 15%, rgba(255,255,255,${amp}) 100%)`,
    }}
  />
);

const RaysSkyline: React.FC<{ o: number }> = ({ o }) => {
  if (o <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <RayWedge b0={-615} b1={-475} amp={0.07} />
      <RayWedge b0={-195} b1={-55} amp={0.35} />
      <RayWedge b0={85} b1={225} amp={0.38} />
      <RayWedge b0={365} b1={505} amp={0.08} />
      {/* bright edge lines at the lit-zone boundaries (measured strengths) */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {[
          [-193, 0.25],
          [-53, 0.55],
          [87, 0.25],
          [227, 0.5],
        ].map(([b, al]) => (
          <line
            key={b}
            x1={-40}
            y1={b - 0.576 * 40}
            x2={1320}
            y2={b + 0.576 * 1320}
            stroke={`rgba(255,255,255,${al})`}
            strokeWidth={3}
          />
        ))}
        <SkylineLine b={-126} seed={3} hMax={120} taper={1900} />
        <SkylineLine b={130} seed={7} hMax={44} />
        <SkylineLine b={410} seed={11} o={0.22} />
      </svg>
    </AbsoluteFill>
  );
};

// Procedural skyline: step-tower outlines running along the beam-edge lines
// (slope 0.576) with drip strokes hanging below — approximating the faint
// city-reflection texture of the reference. Deterministic seeded jitter.
const hash01 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const skylinePath = (seedBase: number, hMax = 34, taper = 0): string => {
  // step function above the line (negative local y = above)
  let d = "M -100 0";
  let x = -100;
  let i = 0;
  while (x < 1600) {
    const seed = seedBase * 1000 + i;
    const w = 10 + hash01(seed) * 26;
    const isTower = hash01(seed + 3) > 0.5;
    const fade = taper > 0 ? Math.max(0.25, 1 - (x + 100) / taper) : 1;
    const h = isTower ? (6 + hash01(seed + 5) * hMax) * fade : 0;
    d += ` L ${x.toFixed(1)} ${(-h).toFixed(1)} L ${(x + w).toFixed(1)} ${(-h).toFixed(1)}`;
    x += w;
    i += 1;
  }
  d += " L 1600 0";
  return d;
};

const SkylineLine: React.FC<{ b: number; seed: number; o?: number; hMax?: number; taper?: number }> = ({ b, seed, o = 0.28, hMax = 34, taper = 0 }) => (
  <g transform={`translate(0 ${b}) rotate(${RAY_DEG})`}>
    <path
      d={skylinePath(seed, hMax, taper)}
      fill="none"
      stroke={`rgba(255,255,255,${o})`}
      strokeWidth={2.2}
    />
    {Array.from({ length: 42 }, (_, k) => {
      const sd = seed * 500 + k;
      if (hash01(sd + 11) < 0.5) return null;
      const x = -100 + k * 40 + hash01(sd) * 30;
      const len = 8 + hash01(sd + 17) * 44;
      return (
        <rect
          key={k}
          x={x}
          y={0}
          width={2.2}
          height={len}
          fill={`rgba(255,255,255,${o * 0.7})`}
        />
      );
    })}
  </g>
);

const OpeningLayer: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame > 118) return null;
  const grow = (f0: number, f1: number) =>
    kf(frame, [f0, f1], [420, 3400], easeOut);
  const slide = (f0: number, speed: number) =>
    frame > f0
      ? (frame - f0) * speed * kf(frame, [f0, f0 + 22], [0.25, 1], Easing.in(Easing.quad))
      : 0;

  const s1 = slide(58, 30);
  const s2 = slide(62, 26);
  const s3 = slide(66, 28);
  const s4 = slide(64, 29);

  const roll = (f0: number, x0: number, y0: number, dirX: number, dirY: number) => {
    const t = kf(frame, [f0, f0 + 55], [0, 1], easeOut);
    return { x: x0 + dirX * t, y: y0 + dirY * t };
  };
  const drift = (p: { x: number; y: number }, vx: number, vy: number, f0: number) => ({
    x: p.x + Math.max(0, frame - f0) * vx,
    y: p.y + Math.max(0, frame - f0) * vy,
  });

  const cA = drift(roll(10, -260, 60, 370, 79), 0.5, 0.11, 65);
  const cB = drift(roll(14, 190, 34, 390, 83), 0.5, 0.11, 69);
  const cC = drift(roll(20, 310, 408, 415, 89), 0.5, 0.11, 75);
  const cD = drift(roll(26, 830, 556, 362, -77), 0.5, -0.11, 81);
  const cE = drift(roll(60, 130, 623, 148, 32), 0.5, 0.11, 115);
  const gate = (f0: number) => (frame >= f0 ? 1 : 0);

  return (
    <AbsoluteFill>
      <Ribbon b={228 + s2} slope={0.2136} faceH={204} stripH={33} growW={grow(14, 52)} sheen />
      <Ribbon
        b={797 + s3}
        slope={0.2136}
        faceH={220}
        stripH={17}
        stripSide="above"
        growW={grow(22, 62)}
      />
      <Ribbon
        b={675 + s4}
        slope={-0.214}
        faceH={220}
        stripH={17}
        stripSide="above"
        growW={grow(28, 68)}
      />
      <Ribbon b={-119 + s1} slope={0.5875} faceH={400} stripH={34} growW={grow(8, 42)} sheen />
      <Coin x={cA.x} y={cA.y + s2} d={164} o={gate(10)} />
      <Coin x={cB.x} y={cB.y + s2} d={164} o={gate(14)} />
      <Coin x={cC.x} y={cC.y + s2} d={164} o={gate(20)} />
      <Coin x={cD.x} y={cD.y + s4} d={164} o={gate(26)} />
      <Coin x={cE.x} y={cE.y + s3} d={150} o={gate(60)} />
    </AbsoluteFill>
  );
};

// Mid coins: piecewise-linear paths threaded through the measured checkpoint
// positions (f240 / f480 / f720 reference frames).
const MID_COINS: Array<{ d: number; fs: number[]; xs: number[]; ys: number[] }> = [
  { d: 60, fs: [105, 780], xs: [78, 386], ys: [512, 651] },
  { d: 62, fs: [105, 830], xs: [300, 325], ys: [658, 655] },
  { d: 52, fs: [400, 480, 720, 830], xs: [-8, 12, 71, 98], ys: [432, 453, 516, 545] },
  { d: 56, fs: [100, 460], xs: [1108, 1268], ys: [100, 226] },
  { d: 52, fs: [440, 480, 690], xs: [1140, 1160, 1265], ys: [127, 138, 197] },
  { d: 64, fs: [640, 720, 830], xs: [1036, 1076, 1131], ys: [80, 103, 135] },
  { d: 58, fs: [100, 260], xs: [878, 918], ys: [6, 28] },
];

const MidLayer: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 90 || frame > 872) return null;
  const o = Math.min(kf(frame, [96, 116], [0, 1]), kf(frame, [812, 838], [1, 0]));
  // drifting thin shallow ribbon — visible f150..f400, then exits upward
  const b3 = kf(frame, [150, 180, 300, 352], [320, 500, 490, 330]);
  const b3o = kf(frame, [330, 354], [1, 0]);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <Ribbon b={-176} slope={0.583} faceH={95} stripH={17} stripSide="below" />
      <Ribbon b={813} slope={0.575} faceH={97} stripH={13} stripSide="above" />
      <Ribbon b={b3} slope={0.2136} faceH={26} stripH={9} stripSide="below" opacity={b3o} faceColor="#79ABFA" stripColor="#DCE8FB" />
      {MID_COINS.map((c, i) => {
        if (frame < c.fs[0] || frame > c.fs[c.fs.length - 1]) return null;
        return (
          <Coin
            key={i}
            x={kf(frame, c.fs, c.xs)}
            y={kf(frame, c.fs, c.ys)}
            d={c.d}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const XLayer: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 812 || frame > 896) return null;
  const p = kf(
    frame,
    [812, 830, 840, 850, 860, 870, 878, 890],
    [880, 444, 377, 334, 291, 233, 130, -380],
  );
  const rollT = frame - 812;
  const onDown = (x: number) => p + 8 + 0.576 * (x - 640);
  const onUp = (x: number) => p - 8 - 0.576 * (x - 640);
  const cxs = [
    { x: 330 + rollT * 0.5, up: false, off: -128, d: 106 },
    { x: 800 + rollT * 0.5, up: false, off: -126, d: 104 },
    { x: 1205 + rollT * 0.4, up: false, off: -128, d: 102 },
    { x: 735 + rollT * 0.5, up: true, off: -60, d: 108 },
  ];
  return (
    <AbsoluteFill>
      <Ribbon b={onDown(640) - 80} slope={0.576} faceH={160} stripH={34} stripSide="above" sheen />
      {cxs.filter((c) => !c.up).map((c, i) => (
        <Coin key={i} x={c.x} y={onDown(c.x) + c.off} d={c.d} />
      ))}
      <Ribbon b={onUp(640) - 80} slope={-0.576} faceH={160} stripH={34} stripSide="above" />
      {cxs.filter((c) => c.up).map((c, i) => (
        <Coin key={`u${i}`} x={c.x} y={onUp(c.x) + c.off} d={c.d} />
      ))}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------- scene: TOK

// Base snapshot at f240 (group-scale peak). Cards/words measured there.
type WordSpec = { p: PathAsset; x: number; y: number; w: number; h: number; f0: number; f1: number };

const TOK = {
  cf: { cx: 390.7, cy: 317.5, w: 441.3, h: 211.9 },
  nyl: { cx: 891.4, cy: 317.8, w: 441.3, h: 211.4 },
  words: [
    { p: tokW0, x: 169, y: 471, w: 479, h: 70, f0: 172, f1: 202 },
    { p: tokW1, x: 674, y: 473, w: 436, h: 77, f0: 190, f1: 218 },
  ] as WordSpec[],
};

const SceneTok: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 98 || frame > 338) return null;
  const g = kf(
    frame,
    [190, 205, 215, 225, 245, 270, 290, 300, 310, 322, 334],
    [0.879, 0.915, 0.97, 0.996, 1.0, 0.978, 0.966, 0.949, 0.915, 0.879, 0.84],
  );
  const gOpacity = kf(frame, [300, 335], [1, 0]);

  const nylAbs = frame < 182;
  const nylS = kf(
    frame,
    [108, 115, 120, 125, 130, 140, 145, 150, 155, 160, 165, 170, 181],
    [1.72, 1.552, 1.475, 1.427, 1.39, 1.33, 1.263, 1.137, 1.026, 0.963, 0.928, 0.907, 0.894],
  );
  const nylCx = kf(
    frame,
    [108, 130, 140, 145, 150, 155, 160, 165, 170, 181],
    [640, 639.5, 648, 678, 741, 799, 830.5, 848, 856.5, 858.7],
  );
  const nylCy = kf(
    frame,
    [108, 115, 120, 125, 130, 140, 145, 150, 155, 160, 165, 170, 181],
    [486, 420, 394.5, 379, 371, 364, 358, 345.5, 334, 328, 324.5, 322.5, 321.9],
  );
  const nylO = kf(frame, [98, 124], [0, 1]);
  const nylSweep = kf(frame, [112, 168], [0, 1]);

  const cfDy = kf(frame, [148, 184], [55, 0], easeOut);
  const cfDx = kf(frame, [148, 184], [-20, 0], easeOut);
  const cfO = kf(frame, [148, 182], [0, 1]);

  return (
    <AbsoluteFill style={{ opacity: gOpacity }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${g})`,
          transformOrigin: "640px 318px",
        }}
      >
        <div style={{ position: "absolute", inset: 0, transform: `translate(${cfDx}px, ${cfDy}px)` }}>
          <Card cx={TOK.cf.cx} cy={TOK.cf.cy} w={TOK.cf.w} h={TOK.cf.h} o={cfO}>
            <CfLogo cardW={TOK.cf.w} />
          </Card>
        </div>
        {!nylAbs ? (
          <Card cx={TOK.nyl.cx} cy={TOK.nyl.cy} w={TOK.nyl.w} h={TOK.nyl.h}>
            <NylLogo cardW={TOK.nyl.w} />
          </Card>
        ) : null}
        {TOK.words.map((wd, i) => (
          <Vec
            key={i}
            p={wd.p}
            x={wd.x}
            y={wd.y}
            w={wd.w}
            h={wd.h}
            o={kf(frame, [wd.f0, wd.f1], [0, 1])}
          />
        ))}
      </div>
      {nylAbs ? (
        <Card cx={nylCx} cy={nylCy} w={431 * nylS} h={206.5 * nylS} o={nylO} sweepT={nylSweep}>
          <NylLogo cardW={431 * nylS} />
        </Card>
      ) : null}
    </AbsoluteFill>
  );
};

// ----------------------------------------------------------- scene: FIRST

const FIRST = {
  card: { cx: 636, cy: 446.5, w: 426, h: 203 },
  hyb: { w: 294, h: 111 },
  words: [
    { p: firstW0, x: 214, y: 214, w: 159, h: 64, f0: 332, f1: 358 },
    { p: firstW1, x: 392, y: 214, w: 359, h: 64, f0: 341, f1: 369 },
    { p: firstW2, x: 767, y: 214, w: 292, h: 81, f0: 350, f1: 381 },
  ] as WordSpec[],
};

const SceneFirst: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 336 || frame > 592) return null;
  const g = kf(
    frame,
    [336, 400, 480, 500, 515, 530, 545, 560, 575, 588],
    [0.93, 0.975, 1.0, 0.986, 0.982, 0.964, 0.936, 0.9, 0.87, 0.84],
    frame < 480 ? easeOut : undefined,
  );
  const gOpacity = kf(frame, [550, 586], [1, 0]);
  const cardS = kf(frame, [372, 440, 460, 480], [0.82, 0.835, 0.94, 1.0]);
  const cardO = kf(frame, [372, 412], [0, 1]);
  return (
    <AbsoluteFill style={{ opacity: gOpacity }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${g})`,
          transformOrigin: "640px 360px",
        }}
      >
        {FIRST.words.map((wd, i) => (
          <Vec
            key={i}
            p={wd.p}
            x={wd.x}
            y={wd.y}
            w={wd.w}
            h={wd.h}
            o={kf(frame, [wd.f0, wd.f1], [0, 1])}
          />
        ))}
        <Card
          cx={FIRST.card.cx}
          cy={FIRST.card.cy}
          w={FIRST.card.w * cardS}
          h={FIRST.card.h * cardS}
          o={cardO}
        >
          <svg
            viewBox={`0 0 ${hybText.vw} ${hybText.vh}`}
            style={{ width: FIRST.hyb.w * cardS, height: FIRST.hyb.h * cardS }}
          >
            <g transform={hybText.tf}>
              <path d={hybText.d} fill={INK} />
            </g>
          </svg>
        </Card>
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------ scene: USHY

const USHY = {
  inst: { cx: 393.5, cy: 484.5, w: 425, h: 203 },
  onchain: { cx: 886, cy: 484.5, w: 426, h: 203 },
  words: [
    { p: ushy1W0, x: 373, y: 144, w: 143, h: 62, f0: 580, f1: 604 },
    { p: ushy1W1, x: 540, y: 142, w: 165, h: 81, f0: 590, f1: 616 },
    { p: ushy1W2, x: 726, y: 144, w: 181, h: 64, f0: 602, f1: 630 },
    { p: ushy2W0, x: 181, y: 245, w: 372, h: 78, f0: 614, f1: 644 },
    { p: ushy2W1, x: 576, y: 244, w: 186, h: 61, f0: 624, f1: 654 },
    { p: ushy2W2, x: 785, y: 240, w: 316, h: 80, f0: 637, f1: 668 },
  ] as WordSpec[],
};

const CardCopy: React.FC<{ p: PathAsset; w: number; h: number }> = ({ p, w, h }) => (
  <svg viewBox={`0 0 ${p.vw} ${p.vh}`} style={{ width: w, height: h }}>
    <g transform={p.tf}>
      <path d={p.d} fill={INK} />
    </g>
  </svg>
);

const SceneUshy: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 584 || frame > 840) return null;
  const hold = kf(
    frame,
    [720, 740, 760, 780, 790, 805, 820, 835],
    [1.0, 0.987, 0.974, 0.952, 0.922, 0.89, 0.86, 0.83],
  );
  const headIn = kf(frame, [578, 640, 690, 720], [0.95, 0.982, 0.995, 1.0]);
  const cardIn = kf(frame, [652, 690, 700, 710, 720], [0.8, 0.861, 0.935, 0.981, 1.0]);
  const cardDy = kf(frame, [652, 700, 710, 720], [39, 20, 7, 0]);
  const gOpacity = kf(frame, [795, 832], [1, 0]);
  const instO = kf(frame, [652, 692], [0, 1]);
  const onchO = kf(frame, [664, 706], [0, 1]);
  const headS = headIn * (frame >= 720 ? hold : 1);
  const cardS = cardIn * (frame >= 720 ? hold : 1);
  return (
    <AbsoluteFill style={{ opacity: gOpacity }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${headS})`,
          transformOrigin: "640px 240px",
        }}
      >
        {USHY.words.map((wd, i) => (
          <Vec
            key={i}
            p={wd.p}
            x={wd.x}
            y={wd.y}
            w={wd.w}
            h={wd.h}
            o={kf(frame, [wd.f0, wd.f1], [0, 1])}
          />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(0px, ${cardDy}px) scale(${cardS})`,
          transformOrigin: "640px 484px",
        }}
      >
        <Card cx={USHY.inst.cx} cy={USHY.inst.cy} w={USHY.inst.w} h={USHY.inst.h} o={instO}>
          <CardCopy p={instText} w={263} h={110} />
        </Card>
        <Card cx={USHY.onchain.cx} cy={USHY.onchain.cy} w={USHY.onchain.w} h={USHY.onchain.h} o={onchO}>
          <CardCopy p={onchainText} w={192} h={109} />
        </Card>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------- scene: LOCKUP

const LOCKUP = {
  cf: { cx: 372.8, cy: 360, w: 457.5, h: 218.6 },
  nyl: { cx: 903.1, cy: 360, w: 457.5, h: 218.6 },
};

const SceneLockup: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 876) return null;
  const s = kf(
    frame,
    [918, 950, 982, 990, 998, 1006, 1014, 1022, 1038, 1054, 1078, 1102, 1126, 1150, 1182, 1199],
    [1.0, 0.984, 0.972, 0.984, 1.02, 1.073, 1.109, 1.121, 1.117, 1.105, 1.089, 1.073, 1.056, 1.04, 1.016, 1.008],
  );
  const cfO = kf(frame, [880, 918], [0, 1]);
  const cfDy = kf(frame, [880, 922], [38, 0], easeOut);
  const nylO = kf(frame, [896, 934], [0, 1]);
  const nylDy = kf(frame, [896, 938], [38, 0], easeOut);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${s})`,
          transformOrigin: "640px 360px",
        }}
      >
        <div style={{ position: "absolute", inset: 0, transform: `translate(0px, ${cfDy}px)` }}>
          <Card cx={LOCKUP.cf.cx} cy={LOCKUP.cf.cy} w={LOCKUP.cf.w} h={LOCKUP.cf.h} o={cfO}>
            <CfLogo cardW={LOCKUP.cf.w} />
          </Card>
        </div>
        <div style={{ position: "absolute", inset: 0, transform: `translate(0px, ${nylDy}px)` }}>
          <Card cx={LOCKUP.nyl.cx} cy={LOCKUP.nyl.cy} w={LOCKUP.nyl.w} h={LOCKUP.nyl.h} o={nylO}>
            <NylLogo cardW={LOCKUP.nyl.w} />
          </Card>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------ composition

export const CentrifugeComposition: React.FC<{ frameOffset?: number }> = ({
  frameOffset = 0,
}) => {
  const frame = useCurrentFrame() + frameOffset;
  const raysO = Math.min(kf(frame, [92, 150], [0, 1]), kf(frame, [814, 862], [1, 0]));
  return (
    <AbsoluteFill style={{ backgroundColor: BG, overflow: "hidden" }}>
      <Pinstripes />
      <MidLayer frame={frame} />
      <OpeningLayer frame={frame} />
      <RaysSkyline o={raysO} />
      <XLayer frame={frame} />
      <SceneTok frame={frame} />
      <SceneFirst frame={frame} />
      <SceneUshy frame={frame} />
      <SceneLockup frame={frame} />
    </AbsoluteFill>
  );
};

export const centrifugeReplicateMeta = {
  id: "Centrifuge-Replicate",
  component: CentrifugeComposition,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
