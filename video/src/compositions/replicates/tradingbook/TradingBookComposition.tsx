import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { loadFont as loadYanone } from "@remotion/google-fonts/YanoneKaffeesatz";
import { loadFont as loadNeucha } from "@remotion/google-fonts/Neucha";
import { measureText } from "@remotion/layout-utils";
import { CAM_A, CAM_B, CAM_B_START } from "./camera-data";
import { HAND_BOX } from "./hand-data";
import {
  BASE_CANDLES,
  GRID_V,
  GRID_H,
  TIME_LABELS,
  PRICE_LABELS,
  TF_TOKENS,
} from "./chart-data";
import { PAYOFF_CANDLES } from "./payoff-data";

export const FPS = 60;
export const DURATION = 1784; // 29.73s — matches reference tradingbook-original.mp4 (59.94fps/1782f)

const { fontFamily: CAVEAT } = loadCaveat("normal", {
  subsets: ["latin"],
  weights: ["400", "600", "700"],
});
const { fontFamily: YANONE } = loadYanone("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "700"],
});
const { fontFamily: NEUCHA } = loadNeucha("normal", {
  subsets: ["latin"],
  weights: ["400"],
});

// ═════════════════════════════════════════════════════════════════
// The reference is ONE static TradingView screenshot, ken-burnsed by
// an editor, with annotation layers drawn on top. Everything below
// lives in "anchor coordinates" — the pixel space of reference frame
// 1210 — and a measured per-frame similarity transform (camera-data)
// maps anchor space onto the screen: screen = s*anchor + (tx, ty).
// Frames 1213–1437 are live action (hand + book) → per-frame plates.
// ═════════════════════════════════════════════════════════════════

const BOOK_START = 1213;
const BOOK_END = 1437; // inclusive

// window (the screenshot's edge) in anchor coords
const WIN_L = -114.6;
const WIN_T = 591.0;
const WIN_R = 1192.4;
const WIN_B = 1326.7;
const WIN_W = WIN_R - WIN_L;
const WIN_H = WIN_B - WIN_T;

// palette (all measured)
const GREEN = "#089981"; // TradingView up-candle (measured at high zoom, f1600)
const RED = "#F23645"; // TradingView down-candle
const GRID = "#F4F4F4";
const CHART_BG = "#FEFEFE";
const PURPLE = "#850999";
const INK_BLACK = "#1E141F";
const TARGET_GREEN = "#0E7C0B";
const SL_RED = "#68000D";
const ORANGE_FILL = "#F49926";
const ORANGE_STROKE = "#1D130B";
const AXIS_FONT = "'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif";

const camAt = (frame: number): [number, number, number] => {
  let arr: number[];
  let idx: number;
  if (frame <= 1212) {
    arr = CAM_A;
    idx = Math.max(0, Math.min(1212, Math.round(frame)));
  } else {
    arr = CAM_B;
    idx = Math.max(0, Math.min(343, Math.round(frame) - CAM_B_START));
  }
  return [arr[idx * 3], arr[idx * 3 + 1], arr[idx * 3 + 2]];
};

// keyframe interpolation over [frame, value] pairs, clamped
const kf = (frame: number, pairs: number[][]): number => {
  const fs = pairs.map((p) => p[0]);
  const vs = pairs.map((p) => p[1]);
  return interpolate(frame, fs, vs, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

const easeInOutSine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// point + unit direction at arc length `al` along a polyline
type Pt = [number, number];
const polyAt = (verts: Pt[], cum: number[], al: number): { p: Pt; d: Pt } => {
  const total = cum[cum.length - 1];
  const a = Math.max(0, Math.min(total, al));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < a) i++;
  const t = (a - cum[i - 1]) / (cum[i] - cum[i - 1]);
  const [x1, y1] = verts[i - 1];
  const [x2, y2] = verts[i];
  const len = cum[i] - cum[i - 1];
  return {
    p: [lerp(x1, x2, t), lerp(y1, y2, t)],
    d: [(x2 - x1) / len, (y2 - y1) / len],
  };
};

// partial polyline as SVG path string up to arc length `al`
const polyPath = (verts: Pt[], cum: number[], al: number): string => {
  const total = cum[cum.length - 1];
  const a = Math.max(0, Math.min(total, al));
  let d = `M ${verts[0][0]} ${verts[0][1]}`;
  for (let i = 1; i < verts.length; i++) {
    if (cum[i] <= a) {
      d += ` L ${verts[i][0]} ${verts[i][1]}`;
    } else {
      const { p } = polyAt(verts, cum, a);
      d += ` L ${p[0]} ${p[1]}`;
      break;
    }
  }
  return d;
};

// ── measured geometry ──
const RES_P1: Pt = [173.0, 858.7];
const APEX: Pt = [723.8, 1015.0];
const SUP_P2: Pt = [173.2, 1090.6];

// black zigzag (flagpole = first leg), one continuous stroke f311-458
const ZZ: Pt[] = [
  [84, 1246.4],
  [294.2, 893.1],
  [343.9, 1065.5],
  [387.9, 919.9],
  [437.8, 1052.9],
  [462.8, 940.8],
  [506.4, 1043.9],
  [538.1, 961.7],
  [576.1, 1037.7],
  [612, 990],
];
const ZZ_CUM = [0, 411.1, 590.5, 742.6, 884.7, 999.5, 1111.5, 1199.6, 1284.5, 1344.2];
// frame → arc length, projected from measured tip samples
const ZZ_AL = [
  [311, 0],
  [320, 11],
  [336, 102],
  [352, 253],
  [368, 451.6],
  [384, 653.1],
  [400, 875.1],
  [416, 1070.7],
  [432, 1228.2],
  [448, 1323.8],
  [458, 1344.2],
];

// dashed projection zigzag f887-959 (arrowhead rides tip)
const PROJ: Pt[] = [
  [613.4, 985.0],
  [744.7, 761.3],
  [765.8, 877.3],
  [911.5, 630.5],
];
const PROJ_CUM = [0, 259.4, 377.3, 663.9];
const PROJ_AL = [
  [887, 0],
  [890, 31],
  [896, 71],
  [902, 125],
  [908, 188],
  [914, 284],
  [920, 351],
  [926, 405],
  [932, 476],
  [938, 539],
  [944, 593],
  [950, 632],
  [956, 657],
  [959, 663.9],
];

// arrows (measured tip samples)
const ARROW1_TIPY = [
  [552, 1250.5],
  [558, 1238],
  [570, 1191],
  [582, 1123],
  [594, 1044],
  [606, 971],
  [618, 916],
  [624, 900],
  [628, 894.6],
];
const ARROW2_TIPY = [
  [680, 985.4],
  [696, 942],
  [704, 903],
  [712, 855],
  [720, 803],
  [728, 751],
  [736, 703],
  [744, 663],
  [752, 636],
  [757, 627.5],
];

const A_DASH_LEFT = [
  [501, 107],
  [507, 98.7],
  [513, 87.8],
  [519, 77.5],
  [525, 66.6],
  [528, 58.4],
];
const B_DASH_LEFT = [
  [561, 284.4],
  [564, 277.1],
  [576, 234.7],
  [588, 190.1],
  [600, 135.1],
  [612, 94.9],
  [618, 59.2],
];
const GREEN_LEFT = [
  [681, 1114.9],
  [710, 947.3],
  [718, 871.2],
  [726, 793.4],
  [734, 719.9],
  [742, 657.4],
  [750, 612.2],
  [758, 591.1],
  [762, 589.9],
];
const SL_RIGHT = [
  [1081, 615],
  [1088, 635],
  [1096, 683],
  [1104, 754],
  [1112, 834],
  [1120, 919],
  [1128, 998],
  [1136, 1063],
  [1144, 1105],
  [1149, 1115.3],
];
const RISK_FRONT = [
  [1046, 984.5],
  [1048, 991],
  [1052, 1006],
  [1056, 1017],
  [1060, 1032],
  [1064, 1049],
  [1068, 1063],
  [1072, 1071],
  [1076, 1080],
  [1080, 1085],
];

// label wipe fractions (letter-by-letter fade ≈ soft wipe)
const LBL_RES_FRAC = [
  [217, 0],
  [219, 0.11],
  [228, 0.26],
  [237, 0.43],
  [246, 0.66],
  [255, 0.81],
  [264, 0.96],
  [267, 1],
];
const LBL_SUP_FRAC = [
  [217, 0],
  [219, 0.07],
  [228, 0.22],
  [237, 0.54],
  [246, 0.7],
  [255, 0.79],
  [264, 0.98],
  [267, 1],
];

// td rasters reveal bottom→top (front y in anchor coords)
const TD1_FRONT = [
  [590, 1129.6],
  [594, 1118.6],
  [600, 1092.7],
  [606, 1068.8],
  [612, 1048.6],
  [618, 1032.4],
  [624, 1022.0],
  [630, 1017.6],
];
const TD2_FRONT = [
  [720, 862.0],
  [723, 854.8],
  [729, 829.1],
  [735, 804.8],
  [741, 784.2],
  [747, 766.8],
  [753, 755.2],
  [759, 750.1],
];

// badge + circle pop
const CIRCLE_R = [
  [799, 0],
  [800, 6.8],
  [802, 9.0],
  [804, 10.1],
  [806, 11.7],
  [808, 12.5],
  [810, 13.3],
  [814, 14.5],
  [816, 14.5],
];
const BADGE_SCALE = [
  [797, 0],
  [798, 0.34],
  [800, 0.49],
  [802, 0.61],
  [806, 0.79],
  [810, 0.9],
  [814, 0.96],
  [820, 1],
];
// "entry LONG" per-char appear frames
const BADGE_CHARS: { ch: string; f: number; cursive: boolean }[] = [
  { ch: "e", f: 826, cursive: true },
  { ch: "n", f: 832, cursive: true },
  { ch: "t", f: 836, cursive: true },
  { ch: "r", f: 840, cursive: true },
  { ch: "y", f: 848, cursive: true },
  { ch: " ", f: 848, cursive: true },
  { ch: "L", f: 852, cursive: false },
  { ch: "O", f: 856, cursive: false },
  { ch: "N", f: 860, cursive: false },
  { ch: "G", f: 864, cursive: false },
];

// ── tip functions (shared by ink + cursor) ──
const resistanceTip = (f: number): Pt => {
  const t = easeInOutSine(clamp01((f - 1) / 91));
  return [lerp(RES_P1[0], APEX[0], t), lerp(RES_P1[1], APEX[1], t)];
};
const supportTip = (f: number): Pt => {
  const t = easeInOutSine(clamp01((f - 97) / 83));
  return [lerp(APEX[0], SUP_P2[0], t), lerp(APEX[1], SUP_P2[1], t)];
};
const zigzagAl = (f: number) => kf(f, ZZ_AL);
const projAl = (f: number) => kf(f, PROJ_AL);

// profit fill (post-book): the reward zone doubles in tone from the entry up
// to the running payoff close. Measured against ref frames 1550–1730: the
// boundary chases each new close with the same 6-frame easeOutCubic the
// candles grow with (fit maxerr ~4 anchor px, rmse 1.7), and once it reaches
// the target line (~f1670) it pins there — the reference never recedes after
// the target is hit, even though later closes fall back below it.
const PROFIT_TOP: number[] = (() => {
  const pairs: number[][] = [];
  for (const c of [...PAYOFF_CANDLES].sort((a, b) => a[7] - b[7])) {
    const p = [c[7], c[6] ? c[2] : c[3]];
    // dedupe frames, keeping the latest close per frame
    if (pairs.length && pairs[pairs.length - 1][0] === p[0]) pairs[pairs.length - 1] = p;
    else pairs.push(p);
  }
  const out: number[] = [];
  let b = pairs[0][1]; // boundary value
  let startF = pairs[0][0];
  let startV = b;
  let target = b;
  let pi = 0;
  let pinned = false;
  for (let f = 1438; f <= 1781; f++) {
    if (pi < pairs.length && f >= pairs[pi][0]) {
      startF = f;
      startV = b;
      while (pi < pairs.length && pairs[pi][0] <= f) target = pairs[pi++][1];
    }
    b = startV + (target - startV) * easeOutCubic(Math.min(1, (f - startF) / 6));
    const clamped = Math.max(626, Math.min(983.5, b));
    if (clamped <= 626) pinned = true;
    out.push(pinned ? 626 : clamped);
  }
  return out;
})();
const profitTopAt = (f: number) =>
  PROFIT_TOP[Math.max(0, Math.min(343, Math.round(f) - 1438))];

// cursor keyframe path (glides between element tips)
const cursorPos = (f: number): Pt | null => {
  if (f >= 1171) return null;
  if (f < 1) return [178, 864];
  if (f <= 92) return resistanceTip(f);
  if (f < 97) {
    const t = (f - 92) / 5;
    return [lerp(APEX[0], 709.4, t), lerp(APEX[1], 1017.0, t)];
  }
  if (f <= 180) return supportTip(f);
  if (f <= 271) return [176, 1095];
  if (f <= 310) {
    const t = easeInOutSine(clamp01((f - 272) / 38));
    return [lerp(176, 85, t), lerp(1095, 1254, t)];
  }
  if (f <= 458) {
    const { p } = polyAt(ZZ, ZZ_CUM, zigzagAl(f));
    return p;
  }
  if (f <= 500) {
    // glide zigzag end → a_dash start; measured via (490,1053)@470, (174,1217)@490
    return [
      kf(f, [
        [458, 612],
        [470, 490],
        [490, 174],
        [500, 107],
      ]),
      kf(f, [
        [458, 990],
        [470, 1053],
        [490, 1217],
        [500, 1250.8],
      ]),
    ];
  }
  if (f <= 530) return [kf(f, A_DASH_LEFT), 1250.8];
  if (f <= 551) {
    const t = easeInOutSine(clamp01((f - 530) / 21));
    return [lerp(58.4, 82.6, t), lerp(1250.8, 1250.5, t)];
  }
  if (f <= 630) return [82.6, kf(f, ARROW1_TIPY)];
  if (f <= 680) {
    return [
      kf(f, [
        [630, 82.6],
        [655, 348],
        [680, 612.8],
      ]),
      kf(f, [
        [630, 894.6],
        [655, 941],
        [680, 985.4],
      ]),
    ];
  }
  if (f <= 757) return [612.8, kf(f, ARROW2_TIPY)];
  if (f <= 825) return [613.3, 632.4];
  if (f <= 880) {
    const t = easeInOutSine(clamp01((f - 825) / 55));
    return [lerp(613.3, 611, t), lerp(632.4, 986, t)];
  }
  if (f <= 887) return [611, 986];
  if (f <= 959) {
    const { p } = polyAt(PROJ, PROJ_CUM, projAl(f));
    return p;
  }
  if (f <= 1000) return [909, 635];
  if (f <= 1040) {
    // glides back down the finished projection path
    const t = easeInOutSine(clamp01((f - 1000) / 40));
    const { p } = polyAt(PROJ, PROJ_CUM, 663.9 * (1 - t));
    return p;
  }
  if (f <= 1046) return [613.4, 985];
  if (f <= 1080) return [615.5, kf(f, RISK_FRONT)];
  if (f <= 1149) return [kf(f, SL_RIGHT), 1087];
  return [1114, 1087];
};

// ═════════════════════════════════════════════════════════════════
// Chart chrome (all static plate content)
// ═════════════════════════════════════════════════════════════════

const Grid: React.FC = () => (
  <g>
    {GRID_V.map((x, i) => (
      <line key={`v${i}`} x1={x} y1={WIN_T} x2={x} y2={1281} stroke={GRID} strokeWidth={1} />
    ))}
    {GRID_H.map((y, i) => (
      <line key={`h${i}`} x1={WIN_L} y1={y} x2={1143} y2={y} stroke={GRID} strokeWidth={1} />
    ))}
    <line x1={1143} y1={WIN_T} x2={1143} y2={1281} stroke="#F0F0F0" strokeWidth={1} />
  </g>
);

// pennant fill: y = mx + b for the two purple lines
const resYAt = (x: number) => 0.2839 * x + 809.55;
const supYAt = (x: number) => -0.1373 * x + 1114.42;

const Candle: React.FC<{ c: number[]; wick?: number; widen?: number }> = ({
  c,
  wick = 1.6,
  widen = -0.3, // measured: bodies rendered ~2 screen px wider than reference at +0.8
}) => {
  const [cx, w, bt, bb, wt, wb, up] = c;
  const col = up ? GREEN : RED;
  return (
    <g>
      <rect x={cx - wick / 2} y={wt} width={wick} height={Math.max(wb - wt, 0.5)} fill={col} />
      <rect
        x={cx - (w + widen) / 2}
        y={bt}
        width={w + widen}
        height={Math.max(bb - bt, 0.8)}
        fill={col}
      />
    </g>
  );
};

// Axis text is TradingView UI chrome: in the reference the glyphs keep a
// fixed SCREEN size (~15px caps) at every camera zoom, while their
// positions (price rows, right-anchor x=1186, chip rect) ride the content
// transform. `k` counter-scales the glyphs against the camera
// (k = 1.8384 / s); under CAM_A s≈1.8384 so k≈1 and nothing changes.
const Axes: React.FC<{ k?: number }> = ({ k = 1 }) => (
  <g fontFamily={AXIS_FONT}>
    {TIME_LABELS.map(([text, cx], i) => {
      const isDate = text.length === 2;
      return (
        <text
          key={`t${i}`}
          x={cx}
          y={1294}
          fontSize={9.5 * k}
          fill={isDate ? "#16191E" : "#23272E"}
          fontWeight={isDate ? 700 : 500}
          textAnchor="middle"
        >
          {text}
        </text>
      );
    })}
    {PRICE_LABELS.map(([text, y], i) => (
      <text
        key={`p${i}`}
        x={1186}
        y={y + 3.8 * k}
        fontSize={10.8 * k}
        fill="#262B33"
        fontWeight={700}
        textAnchor="end"
        stroke="#262B33"
        strokeWidth={0.4 * k}
        paintOrder="stroke"
      >
        {text}
      </text>
    ))}
    {/* USDT unit chip: rect is content-scaled, text/chevron are chrome */}
    <rect x={1146} y={596} width={41} height={16} rx={4} fill="#FFFFFF" stroke="#E2E4EA" strokeWidth={1} />
    <text x={1146 + 7 * k} y={604 + 3.5 * k} fontSize={8 * k} fill="#131722" fontWeight={600}>
      USDT
    </text>
    <g transform={`translate(1187, 604) scale(${k}) translate(-1187, -604)`}>
      <path d="M 1179 601.5 l 2.6 3 l 2.6 -3" fill="none" stroke="#131722" strokeWidth={1} />
    </g>
  </g>
);

// bottom chrome: timeframe row (vector text) + extracted rasters for the
// logo, calendar icon and drawing-tool strip (static plate content)
const BottomBar: React.FC = () => (
  <g fontFamily={AXIS_FONT}>
    <line x1={WIN_L} y1={1300.5} x2={WIN_R} y2={1300.5} stroke="#ECECEC" strokeWidth={1} />
    {TF_TOKENS.map(([text, x0, , , y1], i) => (
      <text key={`tf${i}`} x={x0} y={y1} fontSize={9.5} fill="#3F3F3F">
        {text}
      </text>
    ))}
    <image
      href={staticFile("tradingbook-assets/calendar.png")}
      x={73.2}
      y={1302.6}
      width={27.2}
      height={21.8}
    />
    <image
      href={staticFile("tradingbook-assets/toolbar.png")}
      x={819.5}
      y={1286.1}
      width={369.5}
      height={39.2}
    />
  </g>
);

const TVLogo: React.FC = () => (
  <image
    href={staticFile("tradingbook-assets/tv-logo.png")}
    x={-105.8}
    y={1260.7}
    width={109.9}
    height={15.8}
  />
);

// macOS arrow cursor, hotspot at (0,0), ~10.9x19.6 anchor px (ref 20x35 screen)
const Cursor: React.FC<{ p: Pt }> = ({ p }) => (
  <g transform={`translate(${p[0]}, ${p[1]}) scale(1.07)`}>
    <path
      d="M 0 0 L 0 15.8 L 3.9 12.5 L 6.4 18.4 L 9.1 17.2 L 6.7 11.5 L 11 11.5 Z"
      fill="#010101"
      stroke="#FFFFFF"
      strokeWidth={1.2}
      strokeLinejoin="round"
      paintOrder="stroke"
    />
  </g>
);

// raster label with a soft directional wipe (letter-fade approximation)
const WipeLabel: React.FC<{
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  frac: number; // 0..1 revealed
  dir?: "right" | "up";
}> = ({ src, x, y, w, h, frac, dir = "right" }) => {
  if (frac <= 0) return null;
  const soft = 14; // % soft edge
  const pos = frac * (100 + soft) - soft;
  const grad =
    dir === "right"
      ? `linear-gradient(90deg, black ${pos}%, transparent ${pos + soft}%)`
      : `linear-gradient(0deg, black ${pos}%, transparent ${pos + soft}%)`;
  return (
    <Img
      src={staticFile(src)}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        WebkitMaskImage: frac >= 1 ? undefined : grad,
        maskImage: frac >= 1 ? undefined : grad,
      }}
    />
  );
};

// ═════════════════════════════════════════════════════════════════
// Study-card segment (frames 1213–1437), rebuilt in code.
// The reference films a "Bull pennant" study card with a real hand
// writing over it: white card + Yanone-Kaffeesatz text + hand-drawn
// diagram, over the defocused anchor-view chart. Everything below is
// vector/text except the hand+pen, which rides as per-frame
// alpha-matted sprites (hand-data.ts). All numbers measured on the
// reference (screen px of the 1080x1920 frame).
// ═════════════════════════════════════════════════════════════════

// card geometry
const CARD_L = 164;
const CARD_T = 431;
const CARD_W = 743;
const CARD_H = 1055;
const CARD_R = 48;

// palette (measured)
const BK_INK = "#000000";
const BK_ROYAL = "#1649bd"; // TARGET / Target / 100% / D text blue
const BK_LINE_BLUE = "#0f46d1"; // diagram lines + arrows
const BK_INDIGO = "#362e99"; // single letters A/B/C/D
const BK_VIOLET = "#462884"; // AB / CD tokens
const BK_BREAKOUT = "#30206e";
const BK_GREEN_PATH = "#0c7e6a";
const BK_ORANGE = "#da8d15";
const BK_TICK_RED = "#d53551";
const BK_LABEL_RED = "#d2202c";
const BK_LABEL_GREEN = "#33e936";
const BK_CIRCLE_GREEN = "#2be236";

// Yanone Kaffeesatz vertical metrics: at line-height 1 the cap top sits
// just below the CSS top; final value tuned against rendered stills
const YK_TOP = 0.166;
const NE_TOP = 0.26; // Neucha em top → cap top

// fitted text line: measured ink box + measureText → scaleX (house pattern)
const BookLine: React.FC<{
  x: number;
  x1: number;
  y: number; // ink top (≈ cap/ascender top)
  fs: number;
  spans: { t: string; c?: string }[];
  weight?: 400 | 500 | 700;
  font?: string;
  rotate?: number; // deg, around the line's left edge
  shadow?: string;
  skew?: number;
  tracking?: string;
  strokeW?: number; // -webkit-text-stroke, thickens marker glyphs
}> = ({ x, x1, y, fs, spans, weight = 400, font = YANONE, rotate, shadow, skew, tracking, strokeW }) => {
  const text = spans.map((s) => s.t).join("");
  const natural = measureText({
    text,
    fontFamily: font,
    fontSize: fs,
    fontWeight: String(weight),
    letterSpacing: tracking,
  }).width;
  const scaleX = natural > 0 ? (x1 - x) / natural : 1;
  const tf = [
    rotate ? `rotate(${rotate}deg)` : "",
    skew ? `skewX(${skew}deg)` : "",
    `scaleX(${scaleX.toFixed(4)})`,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y - (font === NEUCHA ? NE_TOP : YK_TOP) * fs,
        fontFamily: font,
        fontSize: fs,
        fontWeight: weight,
        lineHeight: 1,
        letterSpacing: tracking,
        whiteSpace: "pre",
        color: BK_INK,
        transform: tf,
        transformOrigin: "left top",
        textShadow: shadow,
        WebkitTextStroke: strokeW ? `${strokeW}px` : undefined,
      }}
    >
      {spans.map((s, i) => (
        <span key={i} style={s.c ? { color: s.c } : undefined}>
          {s.t}
        </span>
      ))}
    </div>
  );
};

// body copy: [x0, x1, inkTop, spans]
const BODY_FS = 30.6; // cap ≈ 22
const BOOK_BODY: { x: number; x1: number; y: number; spans: { t: string; c?: string }[] }[] = [
  { x: 203, x1: 823, y: 574, spans: [{ t: "- The emergence of such a pattern is preceded by a sharp price" }] },
  { x: 203, x1: 859, y: 611, spans: [{ t: "movement in the form of an almost straight line, accompanied by a" }] },
  { x: 202, x1: 469, y: 647, spans: [{ t: "significant volume of trade." }] },
  { x: 201, x1: 814, y: 691, spans: [{ t: "- After an impulse reaches a certain strong price level, a small" }] },
  { x: 201, x1: 852, y: 727, spans: [{ t: "triangle-like ”band” is formed. After which, in most cases, further" }] },
  { x: 201, x1: 625, y: 764, spans: [{ t: "development of the current trend continues" }] },
  {
    x: 204,
    x1: 804,
    y: 830,
    spans: [{ t: "- " }, { t: "TARGET", c: BK_ROYAL }, { t: " - (the place where you want to close an open trade)" }],
  },
  // right column (beside the diagram)
  { x: 652, x1: 889, y: 1177, spans: [{ t: "- " }, { t: "AB", c: BK_VIOLET }, { t: " - flagpole (distance" }] },
  { x: 651, x1: 898, y: 1217, spans: [{ t: "from the beginning of the" }] },
  { x: 651, x1: 891, y: 1254, spans: [{ t: "formation of the flagpole" }] },
  { x: 651, x1: 889, y: 1290, spans: [{ t: "to the maximum point of" }] },
  { x: 651, x1: 750, y: 1323, spans: [{ t: "the figure)" }] },
  // CD block (bottom left)
  { x: 274, x1: 574, y: 1332, spans: [{ t: "- " }, { t: "CD", c: BK_VIOLET }, { t: " - distance from the" }] },
  { x: 266, x1: 589, y: 1369, spans: [{ t: "last local minimum to the" }] },
  { x: 259, x1: 538, y: 1405, spans: [{ t: "horizontal target line" }] },
];

// hand-drawn diagram, all vector (screen coords)
const BookDiagram: React.FC = () => (
  <svg
    width={1080}
    height={1920}
    viewBox="0 0 1080 1920"
    style={{ position: "absolute", left: 0, top: 0 }}
  >
    <defs>
      <linearGradient id="bk-tri" x1="0" y1="1157" x2="0" y2="1232" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#71d3c3" stopOpacity={0.9} />
        <stop offset="100%" stopColor="#71d3c3" stopOpacity={0.06} />
      </linearGradient>
    </defs>

    {/* teal fill triangles under the zigzag peaks */}
    <polygon points="322,1157 303,1231 353,1232" fill="url(#bk-tri)" />
    <polygon points="390,1175 369,1230 419,1231" fill="url(#bk-tri)" />
    <polygon points="446,1189 428,1227 473,1224" fill="url(#bk-tri)" />

    {/* green price path: flagpole → zigzag → breakout */}
    <path
      d="M 252 1466 L 320 1150 L 361 1241 L 390 1168 L 426 1234 L 445 1186 L 477 1223 L 539 922"
      fill="none"
      stroke={BK_GREEN_PATH}
      strokeWidth={2.2}
      strokeLinejoin="round"
      strokeLinecap="round"
    />

    {/* orange trendlines */}
    <line x1={286} y1={1137} x2={539} y2={1216} stroke={BK_ORANGE} strokeWidth={1.9} strokeLinecap="round" />
    <line x1={284} y1={1260} x2={500} y2={1219.8} stroke={BK_ORANGE} strokeWidth={1.9} strokeLinecap="round" />

    {/* red tick marks astride the trendlines (serifed slash) */}
    {(
      [
        [317, 1140],
        [387, 1160],
        [441, 1176],
        [365, 1254],
        [426, 1243],
        [480, 1236],
      ] as Pt[]
    ).map(([cx, cy], i) => (
      <g key={`tk${i}`} transform={`translate(${cx}, ${cy})`} stroke={BK_TICK_RED} strokeWidth={1.8}>
        <line x1={-3} y1={3.3} x2={3} y2={-3.3} />
        <line x1={1} y1={-4.4} x2={4.7} y2={-2.4} />
        <line x1={-4.7} y1={2.4} x2={-1} y2={4.4} />
      </g>
    ))}

    {/* B / A horizontal levels + left 100% double arrow */}
    <line x1={192} y1={1148} x2={309} y2={1148} stroke={BK_LINE_BLUE} strokeWidth={2.2} />
    <line x1={192} y1={1465.5} x2={247} y2={1465.5} stroke={BK_LINE_BLUE} strokeWidth={2.2} />
    <g stroke={BK_LINE_BLUE} strokeWidth={2.2} fill="none">
      <line x1={222.5} y1={1162} x2={222.5} y2={1459} />
      <path d={`M 214.5 1174 L 222.5 1162 L 230.5 1174`} />
      <path d={`M 214.5 1447 L 222.5 1459 L 230.5 1447`} />
    </g>

    {/* C level + right 100% double arrow + D/target short line */}
    <line x1={494} y1={1192} x2={611} y2={1192} stroke={BK_LINE_BLUE} strokeWidth={2.2} />
    <g stroke={BK_LINE_BLUE} strokeWidth={2.2} fill="none">
      <line x1={562.5} y1={921} x2={562.5} y2={1187} />
      <path d={`M 554.5 933 L 562.5 921 L 570.5 933`} />
      <path d={`M 554.5 1175 L 562.5 1187 L 570.5 1175`} />
    </g>
    <line x1={560} y1={912} x2={611} y2={912} stroke={BK_LINE_BLUE} strokeWidth={2.2} />

    {/* Target crosshair scope: ring + centre dot + 4 cross ticks */}
    <g stroke={BK_LINE_BLUE} strokeWidth={2} fill="none">
      <circle cx={543} cy={911} r={8} />
      <circle cx={543} cy={911} r={2.4} fill={BK_LINE_BLUE} stroke="none" />
      <line x1={543} y1={899.5} x2={543} y2={905.5} />
      <line x1={543} y1={916.5} x2={543} y2={922.5} />
      <line x1={531.5} y1={911} x2={537.5} y2={911} />
      <line x1={548.5} y1={911} x2={554.5} y2={911} />
    </g>

    {/* Breakout arrow + green breakout circle */}
    <g stroke={BK_BREAKOUT} strokeWidth={2} fill="none">
      <path d="M 424 1058 C 438 1096 455 1140 471 1171" />
      <path d={`M 461.5 1166 L 471 1171 L 470.5 1160.5`} />
    </g>
    <circle cx={481} cy={1196} r={11} fill="none" stroke={BK_CIRCLE_GREEN} strokeWidth={1.7} />

    {/* clipart 1: celebrating trader (simplified flat shapes) */}
    <g>
      {/* mint swoosh ribbon + arrow */}
      <path
        d="M 833 1082 C 790 1094 725 1082 716 1046 C 711 1022 733 1008 757 1013"
        fill="none"
        stroke="#06d9ac"
        strokeWidth={15}
        strokeLinecap="round"
      />
      <line x1={757} y1={1013} x2={796} y2={972} stroke="#06d9ac" strokeWidth={14} />
      <polygon points="815,950 781,958 806,984" fill="#06d9ac" />
      {/* person */}
      <path d="M 758 1023 L 761 975 L 794 973 L 799 1023 Z" fill="#7a70e8" />
      <line x1={794} y1={982} x2={824} y2={968} stroke="#7a70e8" strokeWidth={9} strokeLinecap="round" />
      <line x1={764} y1={982} x2={787} y2={976} stroke="#7a70e8" strokeWidth={8} strokeLinecap="round" />
      <path d="M 758 1030 L 799 1028 L 786 1058 L 748 1092 L 736 1082 L 766 1052 Z" fill="#6f64d6" />
      <ellipse cx={762} cy={1085} rx={8} ry={5} fill="#695cb7" />
      <circle cx={788} cy={990} r={9.5} fill="#e9b8b0" />
      <path d="M 779 985 A 10 10 0 0 1 797 984 L 794 976 L 782 976 Z" fill="#2f2a55" />
      <circle cx={780} cy={972} r={4} fill="#2f2a55" />
      <rect x={804} y={1008} width={17} height={17} rx={4} fill="#f17d3d" />
      {/* coins + sparkles */}
      {(
        [
          [715, 982, 12],
          [755, 1008, 8],
          [838, 1034, 11],
          [800, 1068, 9],
          [717, 1079, 12],
        ] as number[][]
      ).map(([cx, cy, r], i) => (
        <g key={`co${i}`}>
          <circle cx={cx} cy={cy} r={r} fill="#eec410" stroke="#e6bb06" strokeWidth={2} />
          <text
            x={cx}
            y={cy + r * 0.5}
            fontSize={r * 1.4}
            fill="#d8a800"
            textAnchor="middle"
            fontFamily={AXIS_FONT}
            fontWeight={700}
          >
            $
          </text>
        </g>
      ))}
      {(
        [
          [734, 956],
          [836, 1007],
          [714, 1049],
          [786, 1084],
        ] as Pt[]
      ).map(([cx, cy], i) => (
        <path
          key={`sp${i}`}
          d={`M ${cx} ${cy - 5} L ${cx + 2} ${cy - 1.5} L ${cx + 5} ${cy} L ${cx + 2} ${cy + 1.5} L ${cx} ${cy + 5} L ${cx - 2} ${cy + 1.5} L ${cx - 5} ${cy} L ${cx - 2} ${cy - 1.5} Z`}
          fill="#e8d72d"
        />
      ))}
    </g>

    {/* charging bull line-art sketch (below the C line) */}
    <g stroke="#2f2f36" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 537 1206 C 532 1199 534 1193 541 1194 C 537 1200 540 1205 545 1206" />
      <path d="M 545 1200 C 556 1192 577 1190 592 1196 C 606 1201 616 1198 620 1190 C 626 1193 623 1201 616 1204" />
      <path d="M 620 1190 C 624 1187 626 1190 624 1194" />
      <path d="M 543 1206 C 541 1214 542 1224 546 1233 M 553 1210 C 552 1220 554 1229 558 1237" />
      <path d="M 592 1200 C 596 1212 598 1224 597 1236 M 604 1204 C 608 1214 610 1226 609 1238" />
      <path d="M 545 1204 C 560 1210 580 1212 596 1206" />
    </g>

    {/* clipart 2: saver + piggy bank line art */}
    <g stroke="#2b2b2b" strokeWidth={2.4} fill="none" strokeLinecap="round">
      <path d="M 712 1381 C 700 1390 698 1408 710 1414 C 722 1420 736 1412 736 1400" stroke="#4e8f82" strokeWidth={2.6} />
      <path d="M 706 1386 C 698 1396 700 1410 712 1416" stroke="#4e8f82" strokeWidth={2} opacity={0.7} />
      <circle cx={745} cy={1405} r={9} />
      <path d="M 741 1414 C 729 1420 724 1438 727 1452 L 729 1466" />
      <path d="M 738 1466 L 740 1450 C 741 1442 745 1436 752 1432" />
      <path d="M 750 1418 C 757 1414 763 1412 758 1412" />
      <circle cx={766} cy={1412} r={9.5} fill="#efd468" />
      <path d="M 777 1396 L 781 1391 M 784 1401 L 789 1398" strokeWidth={2} />
      {/* piggy */}
      <ellipse cx={784} cy={1444} rx={25} ry={19} />
      <path d="M 806 1438 C 812 1439 813 1448 807 1450" />
      <path d="M 792 1427 L 799 1420 L 801 1428" fill="#f2b8c4" />
      <path d="M 796 1440 C 798 1442 798 1444 796 1445" strokeWidth={1.8} />
      <line x1={771} y1={1462} x2={771} y2={1466} />
      <line x1={796} y1={1462} x2={796} y2={1466} />
      <rect x={768} y={1452} width={13} height={4} fill="#eed162" stroke="none" />
      <rect x={778} y={1444} width={11} height={5} fill="#eed162" stroke="none" />
      <rect x={785} y={1452} width={12} height={4} fill="#eed162" stroke="none" />
    </g>
  </svg>
);

// the study card: white rounded rect + header gradient + all text + diagram
const BookCard: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: CARD_L,
      top: CARD_T,
      width: CARD_W,
      height: CARD_H,
      borderRadius: CARD_R,
      background: "#fdfdfd",
      boxShadow: "1px 1.5px 2px rgba(45,40,45,0.7), 3px 4px 8px rgba(60,55,60,0.42)",
      overflow: "hidden",
    }}
  >
    {/* children keep screen coordinates */}
    <div style={{ position: "absolute", left: -CARD_L, top: -CARD_T, width: 1080, height: 1920 }}>
      {/* header gradient (purple → white over 131px) */}
      <div
        style={{
          position: "absolute",
          left: CARD_L,
          top: CARD_T,
          width: CARD_W,
          height: 134,
          background:
            "linear-gradient(180deg, #e0b1f0 0%, #e6b9f4 3%, #ecc4f6 22%, #eeccf7 37%, #f2ddf9 56%, #f7ecfa 76%, #fbf7fd 91%, #fdfdfd 100%)",
        }}
      />
      <BookLine x={422} x1={657} y={458} fs={61} weight={500} spans={[{ t: "Bull pennant" }]} />
      {BOOK_BODY.map((l, i) => (
        <BookLine key={i} x={l.x} x1={l.x1} y={l.y} fs={BODY_FS} tracking="0.024em" spans={l.spans} />
      ))}
      <BookDiagram />
      {/* diagram text labels */}
      <BookLine x={330} x1={444} y={1125} fs={20} rotate={17} spans={[{ t: "Resistance line", c: BK_LABEL_RED }]} />
      <BookLine x={346} x1={431} y={1254} fs={19} rotate={-12} spans={[{ t: "Support line", c: BK_LABEL_GREEN }]} />
      <BookLine x={382} x1={463} y={1022} fs={28} spans={[{ t: "Breakout", c: BK_BREAKOUT }]} />
      <BookLine x={467} x1={525} y={900} fs={28} spans={[{ t: "Target", c: BK_ROYAL }]} />
      <BookLine x={183} x1={196} y={1142} fs={14.5} spans={[{ t: "B", c: BK_INDIGO }]} />
      <BookLine x={181} x1={196} y={1458} fs={14.5} spans={[{ t: "A", c: BK_INDIGO }]} />
      <BookLine x={618} x1={631} y={1186} fs={14.5} spans={[{ t: "C", c: BK_INDIGO }]} />
      <BookLine x={609} x1={622} y={906} fs={14.5} spans={[{ t: "D", c: BK_INDIGO }]} />
      <BookLine x={230} x1={271} y={1289} fs={16} spans={[{ t: "100%", c: BK_ROYAL }]} />
      <BookLine x={572} x1={615} y={1062} fs={16} spans={[{ t: "100%", c: BK_ROYAL }]} />
    </div>
  </div>
);

// page title above the card (marker handwriting with white halo + soft shadow)
const TITLE_SHADOW =
  "0 0 3px #fff, 2.5px 0 1.5px #fff, -2.5px 0 1.5px #fff, 0 2.5px 1.5px #fff, 0 -2.5px 1.5px #fff, 2px 2px 1px #fff, -2px 2px 1px #fff, 4px 4px 4px rgba(108,107,96,0.85)";
const BookTitle: React.FC<{ line?: 1 | 2 }> = ({ line }) => (
  <>
    {line !== 2 && (
      <BookLine
        x={345}
        x1={748}
        y={280}
        fs={66}
        font={NEUCHA}
        skew={-10}
        shadow={TITLE_SHADOW}
        strokeW={1.3}
        spans={[{ t: "Trading BOOK", c: "#15140a" }]}
      />
    )}
    {line !== 1 && (
      <BookLine
        x={398}
        x1={691}
        y={357}
        fs={61}
        font={NEUCHA}
        skew={-10}
        shadow={TITLE_SHADOW}
        strokeW={1.2}
        spans={[
          { t: "link in ", c: "#15140a" },
          { t: "bio", c: "#0a2f9a" },
        ]}
      />
    )}
  </>
);

// ── segment timeline (all measured on the reference) ──
// Entry 1213→1239: the card slides in from the left (exp ease-out) and
// fades over 12f; the title fades IN PLACE (no slide, 1221→1237); the
// chart behind never moves — its defocus σ ramps 0.5→5 over 1213–1237.
// Hold 1240→1402: pixel-static.
// Exit 1403→1419: the WHOLE composite (bg + card + title) bobs, then
// whips down (1413–16, ~55px/f) and up-right (1417–19); the card is
// destroyed by motion blur, never by a plain fade. 1417→1437 the
// zoomed chart whips in underneath and lands exactly on CAM_B at 1438.
const ENTRY_ALPHA = [
  [1213, 0.04], [1214, 0.13], [1215, 0.23], [1216, 0.31], [1217, 0.42],
  [1218, 0.54], [1219, 0.62], [1220, 0.72], [1221, 0.82], [1222, 0.92],
  [1224, 0.98], [1226, 1],
];
// the title fades in place, first line landing before the second
const TITLE1_ALPHA = [
  [1217, 0],
  [1220, 0.15],
  [1222, 0.35],
  [1225, 0.75],
  [1228, 1],
];
const TITLE2_ALPHA = [
  [1220, 0],
  [1224, 0.16],
  [1226, 0.35],
  [1228, 0.57],
  [1232, 0.87],
  [1236, 0.98],
  [1240, 1],
];
const BG_BLUR_SIGMA = [
  [1213, 0.5],
  [1237, 5.6],
];
// exit composite translation (bob → vertical whip → diagonal whip)
const EXIT_DX = [
  [1402, 0], [1403, 0], [1404, 1], [1405, 1], [1406, 3], [1407, 5],
  [1408, 8], [1409, 12], [1410, 19], [1411, 26], [1412, 31], [1413, 32],
  [1414, 26], [1415, 22], [1416, 23], [1417, 46], [1418, 109], [1419, 213],
];
const EXIT_DY = [
  [1402, 0], [1403, 1], [1404, 4], [1405, 10], [1406, 17], [1407, 23],
  [1408, 26], [1409, 21], [1410, 4], [1411, -14], [1412, -18], [1413, 10],
  [1414, 65], [1415, 121], [1416, 152], [1417, 143], [1418, 47], [1419, -147],
];
// incoming chart whip camera (screen = s*anchor + t), solved per frame;
// noisy mid-whip values ride under σ≈12 blur and land exactly on CAM_B[0]
const WHIP_S = [
  [1417, 1.75], [1419, 1.82], [1420, 1.94], [1423, 2.102], [1424, 2.077],
  [1425, 2.052], [1426, 2.012], [1427, 1.987], [1429, 1.997], [1430, 1.937],
  [1431, 1.972], [1432, 1.967], [1433, 1.917], [1434, 1.962], [1435, 2.002],
  [1437, 2.007], [1438, 2.0075],
];
const WHIP_TX = [
  [1417, -600], [1419, -680], [1420, -752], [1423, -794], [1424, -809],
  [1425, -824], [1427, -824], [1428, -836], [1429, -845], [1430, -806],
  [1431, -821], [1432, -812], [1433, -773], [1434, -788], [1435, -803],
  [1436, -794], [1437, -791], [1438, -784.95],
];
const WHIP_TY = [
  [1417, -500], [1419, -710], [1420, -665], [1421, -740], [1423, -704],
  [1424, -767], [1425, -830], [1426, -875], [1427, -920], [1428, -977],
  [1429, -1037], [1430, -1001], [1431, -1052], [1432, -1049], [1433, -983],
  [1434, -1016], [1435, -1031], [1436, -1004], [1437, -983], [1438, -958.85],
];
const WHIP_IN_ALPHA = [
  [1416, 0],
  [1420, 1],
];

// the whole card-era composite (defocused chart + title + card); the exit
// renders it twice at consecutive positions — the reference's frame-blend
// leaves crisp double-exposure ghosts, not a gaussian smear
const CardComposite: React.FC<{ frame: number }> = ({ frame }) => {
  const entryDx = frame < 1238 ? -153 * Math.pow(0.87, frame - 1213) : 0;
  const cardAlpha = kf(frame, ENTRY_ALPHA);
  const bgBlur = kf(frame, BG_BLUR_SIGMA);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, filter: `blur(${bgBlur.toFixed(1)}px)` }}>
        <ChartScene frame={1212} cam={[1, 0, -0.01]} />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: kf(frame, TITLE1_ALPHA) }}>
        <BookTitle line={1} />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: kf(frame, TITLE2_ALPHA) }}>
        <BookTitle line={2} />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: cardAlpha,
          transform: `translateX(${entryDx.toFixed(1)}px)`,
        }}
      >
        <BookCard />
      </div>
    </>
  );
};

const whipCamAt = (f: number): [number, number, number] => [
  kf(f, WHIP_S),
  kf(f, WHIP_TX),
  kf(f, WHIP_TY),
];

const BookSegment: React.FC<{ frame: number }> = ({ frame }) => {
  // exit composite motion; ghost = previous frame's position (frame blend)
  const compDx = kf(frame, EXIT_DX);
  const compDy = kf(frame, EXIT_DY);
  const pDx = kf(frame - 1, EXIT_DX);
  const pDy = kf(frame - 1, EXIT_DY);
  const ghosting = Math.abs(compDx - pDx) + Math.abs(compDy - pDy) > 4;
  const whipAlpha = kf(frame, WHIP_IN_ALPHA);
  const cardEra = frame <= 1419;
  const whipEra = frame >= 1417;

  // hand sprite: file j = frame - 1213 holds reference frame 1213 + j
  const li = Math.min(Math.max(frame - 1213, 1), 225);
  const bi = (li - 1) * 4;
  const hx = HAND_BOX[bi];
  const hy = HAND_BOX[bi + 1];
  const hw = HAND_BOX[bi + 2];
  const hh = HAND_BOX[bi + 3];

  return (
    <AbsoluteFill style={{ background: "#FDFCED", overflow: "hidden" }}>
      {/* card-era composite, double-exposed while the exit whips it out */}
      {cardEra &&
        (ghosting
          ? [
              { dx: pDx, dy: pDy, o: 0.45 },
              { dx: compDx, dy: compDy, o: 0.55 },
            ]
          : [{ dx: compDx, dy: compDy, o: 1 }]
        ).map((c, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              transform: `translate(${c.dx.toFixed(1)}px, ${c.dy.toFixed(1)}px)`,
              opacity: (whipEra ? 1 - whipAlpha : 1) * c.o,
              filter: ghosting ? "blur(1.2px)" : undefined,
            }}
          >
            <CardComposite frame={frame} />
          </div>
        ))}

      {/* incoming zoomed chart: current view solid + two trailing camera
          echoes on top (the reference shows discrete ghost echoes from
          frame blending, not one smooth smear) */}
      {whipEra && (
        <div style={{ position: "absolute", inset: 0, opacity: whipAlpha }}>
          <div style={{ position: "absolute", inset: 0, filter: "blur(1.8px)" }}>
            <ChartScene frame={frame} cam={whipCamAt(frame)} />
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: 0.32, filter: "blur(2.4px)" }}>
            <ChartScene frame={frame} cam={whipCamAt(frame - 0.8)} />
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: 0.2, filter: "blur(3px)" }}>
            <ChartScene frame={frame} cam={whipCamAt(frame - 1.6)} />
          </div>
        </div>
      )}

      {/* the one irreducible raster: the live hand + pen */}
      {hw > 0 && (
        <Img
          src={staticFile(`tradingbook-assets/hand/h_${String(li).padStart(4, "0")}.webp`)}
          style={{
            position: "absolute",
            left: hx,
            top: hy,
            width: hw,
            height: hh,
            filter: "drop-shadow(-7px 10px 8px rgba(60,50,45,0.22))",
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════════
// Main composition
// ═════════════════════════════════════════════════════════════════

export const TradingBookComposition: React.FC = () => {
  const rawFrame = useCurrentFrame();
  const frame = Math.min(rawFrame, 1781);

  // ── study-card segment: rebuilt in code (chart under blur + vector card
  //    + alpha-matted hand sprite) ──
  if (frame >= BOOK_START && frame <= BOOK_END) {
    return <BookSegment frame={frame} />;
  }

  return <ChartScene frame={frame} />;
};

// The full chart world (window, candles, ink, chrome) at a given frame.
// `cam` overrides the measured camera path (used by the book segment,
// whose background holds the anchor view); with an override the
// velocity motion-blur is disabled — the caller supplies its own.
const ChartScene: React.FC<{ frame: number; cam?: [number, number, number] }> = ({
  frame,
  cam,
}) => {
  const [s, tx, ty] = cam ?? camAt(frame);

  // velocity-proportional motion blur, measured as the apparent motion of
  // the content point at screen center (zooms produce ~zero center motion,
  // matching the sharp reference zoom-out; the whip-bounce blurs hard)
  const inSeg = (f: number) =>
    frame <= 1212 ? Math.min(f, 1212) : Math.max(Math.min(f, 1781), CAM_B_START);
  const camP = camAt(inSeg(frame - 1));
  const camN = camAt(inSeg(frame + 1));
  const pc: Pt = [(540 - tx) / s, (960 - ty) / s];
  const vx = (camN[0] * pc[0] + camN[1] - (camP[0] * pc[0] + camP[1])) / 2;
  const vy = (camN[0] * pc[1] + camN[2] - (camP[0] * pc[1] + camP[2])) / 2;
  const blurX = cam ? 0 : Math.min(Math.abs(vx) * 0.05, 12);
  const blurY = cam ? 0 : Math.min(Math.abs(vy) * 0.075, 22);
  const blurred = blurX > 0.6 || blurY > 0.6;

  // ── ink states ──
  const resTip = resistanceTip(frame);
  const supTip = supportTip(frame);
  const zzAl = zigzagAl(frame);
  const pjAl = projAl(frame);
  const pjTip = polyAt(PROJ, PROJ_CUM, pjAl);
  const rewardTop = frame >= 959 ? 626.0 : Math.max(626, Math.min(983.5, pjTip.p[1]));
  const circleR = kf(frame, CIRCLE_R);
  const badgeScale = kf(frame, BADGE_SCALE);
  const cursor = cursorPos(frame);
  const arrow1Tip = kf(frame, ARROW1_TIPY);
  const arrow2Tip = kf(frame, ARROW2_TIPY);

  const fadeIn = (f0: number, f1: number) =>
    interpolate(frame, [f0, f1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "#FAFBEE", // measured surround (250,251,238)
        overflow: "hidden",
      }}
    >
      {/* blur filter def (applied to the camera world) */}
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          <filter id="tb-mblur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={`${blurX} ${blurY}`} />
          </filter>
        </defs>
      </svg>

      {/* ═══ camera world (anchor space → screen) ═══ */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate(${tx}px, ${ty}px) scale(${s})`,
          transformOrigin: "0 0",
          filter: blurred ? "url(#tb-mblur)" : undefined,
        }}
      >
        {/* editor drop shadow: hard navy bands hugging the right + bottom edges
            (measured column/row profiles at f990/f1780 — not a soft blur) */}
        <div
          style={{
            position: "absolute",
            left: WIN_R,
            top: WIN_T + 6,
            width: 46,
            height: WIN_H + 44,
            background:
              "linear-gradient(90deg, rgba(40,48,85,0.97) 0%, rgba(40,48,85,0.85) 17%, rgba(45,53,90,0.77) 35%, rgba(52,60,95,0.62) 52%, rgba(60,68,100,0.36) 70%, rgba(70,78,108,0.13) 87%, rgba(80,88,115,0) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: WIN_L + 6,
            top: WIN_B + 4.5,
            width: WIN_W - 6,
            height: 46,
            background:
              "linear-gradient(180deg, rgba(40,48,85,0.95) 0%, rgba(45,53,90,0.8) 22%, rgba(48,56,92,0.7) 40%, rgba(55,63,97,0.45) 58%, rgba(65,73,104,0.2) 75%, rgba(75,83,110,0.05) 90%, rgba(80,88,115,0) 100%)",
          }}
        />
        {/* black border line just below the window bottom (measured ~(30,30,30)) */}
        <div
          style={{
            position: "absolute",
            left: WIN_L,
            top: WIN_B + 1,
            width: WIN_W,
            height: 1.4,
            background: "rgba(25,25,25,0.75)",
          }}
        />
        {/* window: rim + periwinkle glow (top/left) + hard shadow bands (above) */}
        <div
          style={{
            position: "absolute",
            left: WIN_L,
            top: WIN_T,
            width: WIN_W,
            height: WIN_H,
            background: CHART_BG,
            borderRadius: 3,
            // measured frame: periwinkle glow top/left (no dark), navy rim +
            // long dark drop shadow bottom/right (asymmetric lighting)
            boxShadow: [
              "0 0 0 1.3px #8696D2",
              "inset 1.5px 1.5px 0 #C9D6F9",
              "inset 0 -3px 0 rgba(85,89,114,0.85)",
              "-4px -4px 12px rgba(153,170,239,0.95)",
              "-12px -12px 45px rgba(153,170,239,0.8)",
              "-16px -16px 120px rgba(153,170,239,0.25)",
            ].join(", "),
            overflow: "hidden",
          }}
        >
          {/* inner wrapper: children use anchor coords */}
          <div style={{ position: "absolute", left: -WIN_L, top: -WIN_T }}>
            {/* ── layer 1: chart plate + ink (SVG, z = document order) ── */}
            <svg
              width={WIN_W}
              height={WIN_H}
              viewBox={`${WIN_L} ${WIN_T} ${WIN_W} ${WIN_H}`}
              style={{ position: "absolute", left: WIN_L, top: WIN_T, overflow: "visible" }}
            >
              <defs>
                <filter id="tb-cand-shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0.7" dy="0.9" stdDeviation="0.8" floodColor="#000" floodOpacity="0.28" />
                </filter>
                <filter id="tb-badge-shadow" x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="2" dy="2.5" stdDeviation="2" floodColor="#000" floodOpacity="0.3" />
                </filter>
                {/* pennant fill: denser toward the support line (re-fit to ref
                    RGB deltas at (300,1150)/(800,1040): hue more magenta, ~0.72x) */}
                <linearGradient id="tb-pennant" x1="0" y1="858.7" x2="0" y2="1090.6" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="rgba(203,35,213,0.022)" />
                  <stop offset="25%" stopColor="rgba(203,35,213,0.04)" />
                  <stop offset="45%" stopColor="rgba(203,35,213,0.072)" />
                  <stop offset="60%" stopColor="rgba(203,35,213,0.115)" />
                  <stop offset="75%" stopColor="rgba(203,35,213,0.133)" />
                  <stop offset="90%" stopColor="rgba(203,35,213,0.173)" />
                  <stop offset="100%" stopColor="rgba(203,35,213,0.18)" />
                </linearGradient>
                {/* 45° soft hatch riding anchor space (measured 3.4px pitch) */}
                <pattern id="tb-hatch-teal" width="4.84" height="4.84" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                  <rect width="4.84" height="4.84" fill="rgba(8,153,129,0.07)" />
                  <rect width="1.4" height="4.84" fill="rgba(8,153,129,0.055)" />
                </pattern>
                <pattern id="tb-hatch-pink" width="4.88" height="4.88" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                  <rect width="4.88" height="4.88" fill="rgba(242,54,69,0.085)" />
                  <rect width="1.4" height="4.88" fill="rgba(242,54,69,0.055)" />
                </pattern>
              </defs>

              <Grid />

              {/* watermark removed on request — blank chart background */}

              {/* pink pennant fill — clipped at the support tip x while drawing */}
              {frame >= 99 &&
                (() => {
                  const tipX = supTip[0];
                  return (
                    <polygon
                      points={`${tipX},${resYAt(tipX)} ${APEX[0]},${APEX[1]} ${tipX},${supYAt(tipX)}`}
                      fill="url(#tb-pennant)"
                    />
                  );
                })()}

              {/* base candles */}
              {BASE_CANDLES.map((c, i) => (
                <Candle key={`bc${i}`} c={c} />
              ))}

              {/* reward / risk zones (above candles+fill, below ink) */}
              {frame >= 887 && (
                <rect
                  x={615}
                  y={rewardTop}
                  width={1115.3 - 615}
                  height={Math.max(983.5 - rewardTop, 0)}
                  fill="url(#tb-hatch-teal)"
                />
              )}
              {frame >= 1046 && (
                <rect
                  x={615}
                  y={984.5}
                  width={1115.3 - 615}
                  height={Math.max(kf(frame, RISK_FRONT) - 984.5, 0)}
                  fill="url(#tb-hatch-pink)"
                />
              )}
              {/* profit fill: second hatch layer entry → running close (doubles the tone) */}
              {frame >= 1438 && (
                <rect
                  x={615}
                  y={profitTopAt(frame)}
                  width={1115.3 - 615}
                  height={Math.max(983.5 - profitTopAt(frame), 0)}
                  fill="url(#tb-hatch-teal)"
                />
              )}

              {/* payoff candles (grow from the open over ~5 frames) */}
              <g filter="url(#tb-cand-shadow)">
                {PAYOFF_CANDLES.map((c, i) => {
                  const [cx, w, bt, bb, wt, wb, up, f0] = c;
                  if (frame < f0) return null;
                  const t = easeOutCubic(clamp01((frame - f0) / 5));
                  let rt: number;
                  let rb: number;
                  if (up) {
                    // grows upward from the open (bodyBot)
                    rt = lerp(bb, wt, t);
                    rb = lerp(bb + 1, wb, t);
                  } else {
                    rt = lerp(bt - 1, wt, t);
                    rb = lerp(bt, wb, t);
                  }
                  return (
                    <g key={`pc${i}`}>
                      <clipPath id={`pcc${i}`}>
                        <rect x={cx - w} y={rt} width={w * 2} height={Math.max(rb - rt, 0.5)} />
                      </clipPath>
                      <g clipPath={t < 1 ? `url(#pcc${i})` : undefined}>
                        <Candle c={[cx, w, bt, bb, wt, wb, up]} wick={1} />
                      </g>
                    </g>
                  );
                })}
              </g>

              {/* ── editor ink (above candles) ── */}
              {/* purple trendlines */}
              {frame >= 1 && (
                <line
                  x1={RES_P1[0]}
                  y1={RES_P1[1]}
                  x2={resTip[0]}
                  y2={resTip[1]}
                  stroke={PURPLE}
                  strokeWidth={4.5}
                  strokeLinecap="round"
                />
              )}
              {frame >= 97 && (
                <line
                  x1={APEX[0]}
                  y1={APEX[1]}
                  x2={supTip[0]}
                  y2={supTip[1]}
                  stroke={PURPLE}
                  strokeWidth={4.5}
                  strokeLinecap="round"
                />
              )}

              {/* black zigzag (flagpole + bounces), one stroke */}
              {frame >= 311 && (
                <path
                  d={polyPath(ZZ, ZZ_CUM, zzAl)}
                  fill="none"
                  stroke={INK_BLACK}
                  strokeWidth={2.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* blue dashed A / B levels */}
              {frame >= 501 && (
                <line
                  x1={kf(frame, A_DASH_LEFT)}
                  y1={1250.8}
                  x2={107}
                  y2={1250.8}
                  stroke="#0A1F70"
                  strokeWidth={2.7}
                  strokeDasharray="8.2 2.7"
                />
              )}
              {frame >= 561 && (
                <line
                  x1={kf(frame, B_DASH_LEFT)}
                  y1={893.2}
                  x2={284.4}
                  y2={893.2}
                  stroke="#132576"
                  strokeWidth={2.7}
                  strokeDasharray="8.2 2.7"
                />
              )}

              {/* arrow 1: A → B */}
              {frame >= 552 && (
                <g>
                  <line x1={82.6} y1={1250.5} x2={82.6} y2={arrow1Tip + 5} stroke="#062383" strokeWidth={2.7} />
                  <path
                    d={`M ${82.6 - 5.45} ${arrow1Tip + 6.9} L 82.6 ${arrow1Tip} L ${82.6 + 5.45} ${arrow1Tip + 6.9} Z`}
                    fill="#062383"
                  />
                </g>
              )}
              {/* arrow 2: C → D */}
              {frame >= 680 && (
                <g>
                  <line x1={612.8} y1={985.4} x2={612.8} y2={arrow2Tip + 5} stroke="#062383" strokeWidth={2.7} />
                  <path
                    d={`M ${612.8 - 5.45} ${arrow2Tip + 6.9} L 612.8 ${arrow2Tip} L ${612.8 + 5.45} ${arrow2Tip + 6.9} Z`}
                    fill="#062383"
                  />
                </g>
              )}

              {/* green target line (draws right → left) */}
              {frame >= 681 && (
                <line
                  x1={kf(frame, GREEN_LEFT)}
                  y1={624.8}
                  x2={1114.9}
                  y2={624.8}
                  stroke={TARGET_GREEN}
                  strokeWidth={2.7}
                />
              )}

              {/* dashed projection zigzag + barb arrowhead riding the tip */}
              {frame >= 887 && (
                <g>
                  <path
                    d={polyPath(PROJ, PROJ_CUM, pjAl)}
                    fill="none"
                    stroke="#1E1E1B"
                    strokeWidth={2.7}
                    strokeDasharray="7.2 3.6"
                  />
                  <g
                    transform={`translate(${pjTip.p[0]}, ${pjTip.p[1]}) rotate(${
                      (Math.atan2(pjTip.d[1], pjTip.d[0]) * 180) / Math.PI + 90
                    })`}
                  >
                    <path d="M -5.5 12 L 0 0 L 5.5 12 L 0 8 Z" fill="#1E1E1B" />
                  </g>
                </g>
              )}

              {/* stop-loss line (draws left → right) */}
              {frame >= 1081 && (
                <g>
                  <line
                    x1={615}
                    y1={1087.5}
                    x2={kf(frame, SL_RIGHT)}
                    y2={1087.5}
                    stroke="rgba(90,90,90,0.35)"
                    strokeWidth={2.6}
                  />
                  <line
                    x1={615}
                    y1={1085.2}
                    x2={kf(frame, SL_RIGHT)}
                    y2={1085.2}
                    stroke={SL_RED}
                    strokeWidth={3.2}
                  />
                </g>
              )}

              {/* orange breakout circle + badge */}
              {frame >= 799 && (
                <g filter="url(#tb-badge-shadow)">
                  <circle cx={613} cy={984.3} r={Math.max(circleR, 0.1)} fill={ORANGE_FILL} />
                  <circle
                    cx={613}
                    cy={984.3}
                    r={Math.max(circleR + 1.6, 0.1)}
                    fill="none"
                    stroke={ORANGE_STROKE}
                    strokeWidth={3.2}
                  />
                </g>
              )}
              {frame >= 797 && badgeScale > 0 && (
                <g
                  filter="url(#tb-badge-shadow)"
                  transform={`translate(703.1, 984.1) scale(${badgeScale}) translate(-703.1, -984.1)`}
                >
                  {/* measured outer envelope 139.1x36.5 — inset by half stroke so
                      the straddling stroke lands inside the measurement */}
                  <rect
                    x={635.65}
                    y={967.25}
                    width={135.6}
                    height={33}
                    rx={6.3}
                    fill="#F39927"
                    stroke={ORANGE_STROKE}
                    strokeWidth={3.5}
                  />
                </g>
              )}

              <TVLogo />
              <Axes k={1.8384 / s} />
              <BottomBar />
            </svg>

            {/* ── layer 2: handwritten rasters + badge text (HTML) ── */}
            {/* Resistance line / Support line */}
            <WipeLabel
              src="tradingbook-assets/labels/resistance.png"
              x={340.9}
              y={887.5}
              w={108.2}
              h={40.8}
              frac={kf(frame, LBL_RES_FRAC)}
            />
            <WipeLabel
              src="tradingbook-assets/labels/support.png"
              x={350.6}
              y={1062.7}
              w={89.3}
              h={25.6}
              frac={kf(frame, LBL_SUP_FRAC)}
            />
            {/* A / B / C / D letters (fade in place) */}
            {frame >= 526 && (
              <Img
                src={staticFile("tradingbook-assets/labels/a.png")}
                style={{ position: "absolute", left: 61.7, top: 1233.0, width: 11.4, height: 15.2, opacity: fadeIn(526, 531) }}
              />
            )}
            {frame >= 626 && (
              <Img
                src={staticFile("tradingbook-assets/labels/b.png")}
                style={{ position: "absolute", left: 61.1, top: 875.6, width: 13.6, height: 15.3, opacity: fadeIn(626, 631) }}
              />
            )}
            {frame >= 685 && (
              <Img
                src={staticFile("tradingbook-assets/labels/c.png")}
                style={{ position: "absolute", left: 592.1, top: 952.8, width: 10.9, height: 15.8, opacity: fadeIn(685, 691) }}
              />
            )}
            {frame >= 756 && (
              <Img
                src={staticFile("tradingbook-assets/labels/d.png")}
                style={{ position: "absolute", left: 592.1, top: 605.3, width: 11.4, height: 16.3, opacity: fadeIn(756, 761) }}
              />
            )}
            {/* "Target distance" rasters, reveal bottom → top */}
            {frame >= 590 && (
              <WipeLabel
                src="tradingbook-assets/labels/target-distance.png"
                x={61.6}
                y={1017.6}
                w={19}
                h={112}
                frac={clamp01((1129.6 - kf(frame, TD1_FRONT)) / 112)}
                dir="up"
              />
            )}
            {frame >= 720 && (
              <WipeLabel
                src="tradingbook-assets/labels/target-distance.png"
                x={592.1}
                y={750.1}
                w={19}
                h={112}
                frac={clamp01((862.0 - kf(frame, TD2_FRONT)) / 112)}
                dir="up"
              />
            )}
            {/* Target / Stop-loss labels */}
            <WipeLabel
              src="tradingbook-assets/labels/target.png"
              x={883}
              y={602}
              w={57}
              h={19}
              frac={kf(frame, [
                [966, 0.05],
                [974, 0.36],
                [986, 0.7],
                [998, 1],
              ])}
            />
            <WipeLabel
              src="tradingbook-assets/labels/stop-loss.png"
              x={816}
              y={1089}
              w={91}
              h={23}
              frac={kf(frame, [
                [1121, 0.08],
                [1130, 0.36],
                [1145, 0.68],
                [1160, 0.92],
                [1172, 1],
              ])}
            />
            {/* "entry LONG" — per-char fade */}
            {frame >= 826 && (
              <div
                style={{
                  position: "absolute",
                  left: 650.8,
                  top: 966,
                  width: 106.1,
                  height: 30,
                  display: "flex",
                  alignItems: "baseline",
                  whiteSpace: "pre",
                }}
              >
                {BADGE_CHARS.map((c, i) => (
                  <span
                    key={i}
                    style={{
                      fontFamily: CAVEAT,
                      fontSize: c.cursive ? 26 : 28.5,
                      fontWeight: 400, // measured: 600 rendered ~70% more dark pixels than ref

                      letterSpacing: c.cursive ? undefined : "1px",
                      marginLeft: c.ch === "L" ? 4 : undefined,
                      color: "#2D1500",
                      opacity: fadeIn(c.f, c.f + 4),
                      lineHeight: 1,
                    }}
                  >
                    {c.ch}
                  </span>
                ))}
              </div>
            )}

            {/* ── layer 3: fake cursor (topmost) ── */}
            {cursor && (
              <svg
                width={WIN_W}
                height={WIN_H}
                viewBox={`${WIN_L} ${WIN_T} ${WIN_W} ${WIN_H}`}
                style={{ position: "absolute", left: WIN_L, top: WIN_T, pointerEvents: "none" }}
              >
                <Cursor p={cursor} />
              </svg>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const tradingBookReplicateMeta = {
  id: "TradingBook-Replicate",
  component: TradingBookComposition,
  width: 1080,
  height: 1920,
  fps: FPS,
  durationInFrames: DURATION,
};
