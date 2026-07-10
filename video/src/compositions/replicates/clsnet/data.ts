// CLSNet replica — all measured values live here (replicate-method lesson 6:
// copy/colors/positions editable in one module; no invented numbers).
// Measured from public/clsnet-original.mp4 (1920×1080, 25fps, 4168f).

export const FPS = 25;
export const DURATION = 4168;
export const W = 1920;
export const H = 1080;

// ─── Palette (pixel-probed) ───
export const C = {
  navy: "#002753", // background + strokes + wordmark boxes
  white: "#FDFDFD",
  blue: "#4CA0D3", // map/globe light blue (76,160,211)
  orange: "#D45837", // illustration accent (212,88,55)
  orangeDeep: "#C74D33", // filled pills / labels
  grey: "#A8A8A8", // illustration shadow fill
  band: "#D9D9D9", // timeline ruler band grey
  panel: "#E8E8E8", // matching panel grey
  card35: "#646C8C", // Principle 35 card body
  card35Strip: "#82879F", // Principle 35 bottom strip
  card50: "#2F687F", // Principle 50 card body
  card50Strip: "#5B8393", // Principle 50 bottom strip
  cardText: "#B0B2C1", // "Principle" text on cards
  lavender: "#ABB1CC", // gantt pill / detail card
  tan: "#E9C8B0", // tan pill
  steel: "#8296B4", // steel-blue pill (light)
  steelDark: "#5B6E93", // steel-blue pill (mid)
  pillNavy: "#0B2A56", // darkest pill
  swatchBlue: "#2196C9", // "Unmatched" legend swatch
  serifNavy: "#12365B", // serif label ink (USD etc.)
} as const;

// ─── Type ───
// Wordmark/serif labels: Financier-like transitional serif (closest hosted match).
// Body sans: Helvetica Neue (matches "Supporting adherence…" et al).
export const SANS = "Helvetica Neue, Helvetica, Arial, sans-serif";

// ─── Segment timeline (frames @25fps) ───
export const SEG = {
  title: [0, 150],
  rows: [148, 320],
  hexRow: [320, 366],
  flows: [366, 462],
  globe: [462, 566],
  mapDraw: [560, 592],
  mapHexes: [592, 745],
  network: [745, 913],
  citiesIntro: [913, 1040],
  pairs: [1040, 1302],
  hexify: [1302, 1412],
  tradeDocs: [1412, 1462],
  matching: [1462, 1662],
  reportsUp: [1662, 1770],
  locks: [1770, 1930],
  strip: [1930, 2141], // ref pushes strip up 2127-2141 (measured f2133 mid-push)
  gantt: [2127, 2324], // gantt page rides up from below; panel shrinks into doc by 2324
  reportOut: [2324, 2412],
  handshake: [2372, 2480],
  payment: [2480, 2612],
  strip2: [2612, 2822],
  reportCard: [2822, 3104], // owns bg through the card-collapse + build-pop phase
  buildPop: [2990, 3104],
  mapBadges: [3104, 3290],
  implode: [3290, 3364],
  circle: [3364, 3480],
  mosaic: [3477, 3645],
  shield: [3641, 3690], // zipper 3642, white wipe 3645-3657, shield 3661-3672 (probed)
  ledge: [3690, 3822], // band rotates 90°→see-saw→flat (θ measured at 3708/3732/3762)
  citiesStacks: [3822, 3926],
  outro: [3926, 4002],
  endcard: [4002, 4168],
} as const;

// ─── Copy (read off frames — exact) ───
export type CopyShape = {
  brand: string;
  tagline: string;
  supporting: string;
  p35: { kicker: string; num: string; strip: string };
  p50: { kicker: string; num: string; strip: string };
  currencies120: string;
  tradeExecuted: string;
  unmatched: string;
  matched: string;
  paymentComplete: string;
  disclaimer: string;
  url: string;
  detail: [string, string][];
  ganttIds: string[];
  gantt2nd: string;
  pairSchedule: { top: string; bottom: string; in: number; out: number }[];
  docLabels: string[];
};

export const COPY: CopyShape = {
  brand: "CLSNet",
  tagline: "trusted market solutions",
  supporting: "Supporting adherence to the FX Global Code:",
  p35: { kicker: "Principle", num: "35", strip: "Settlement risk" },
  p50: { kicker: "Principle", num: "50", strip: "Netting &\nsettlement process" },
  currencies120: "120 currencies",
  tradeExecuted: "Trade executed",
  unmatched: "Unmatched",
  matched: "Matched",
  paymentComplete: "Payment complete",
  disclaimer: "Any new solution is subject\nto all necessary approvals",
  url: "cls-group.com/clsnet",
  detail: [
    ["Counterparty", "Bank B"],
    ["Unique Identifier", "BC16ERO8G005EY6"],
    ["Currency", "USD"],
    ["Value Date", "2022/02/15"],
    ["Netted Position", "-8, 242, 547"],
  ],
  ganttIds: [
    "BC16ASO8G005EM9E",
    "BC16ERO8G005EY6Y",
    "BC17BHO8G005PO1I",
    "BC22FEP6G032EN8E",
    "BC13RSO8G005UY2Y",
    "BC01RNG3T157JJ91L",
    "BC75GHO8H281EM4U",
    "BC11OID3S96IEM5R",
    "BC01TYO3V027FG1K",
  ],
  gantt2nd: "BC17BHO8G005PO1I",
  // currency pair carousel during SEG.pairs (r5 measured: five pairs at
  // ~38f cadence; old pair fades IN PLACE ~8f from `out`, next pair RISES
  // ~90px into the slots from `in`; label caps 58-60px → fs 84)
  pairSchedule: [
    { top: "USD", bottom: "CNH", in: 1098, out: 1132 },
    { top: "EUR", bottom: "RUB", in: 1136, out: 1170 },
    { top: "USD", bottom: "TRY", in: 1174, out: 1208 },
    { top: "EUR", bottom: "PLN", in: 1212, out: 1246 },
    { top: "EUR", bottom: "CZK", in: 1250, out: 1282 },
  ],
  docLabels: ["Tom/\nnext\nday", "NDF", "Same\nday", "Spot", "Swaps"],
};

// ─── Title scene geometry (t=4.5 settled, pixel-measured) ───
export const TITLE = {
  logo: { x: 135, y: 78, w: 300, h: 100 }, // CLS logo block top-left
  supporting: { x: 860, y: 283, fs: 38 }, // sans white
  wordmark: { x: 128, capTop: 468, capHeight: 140, right: 860 }, // CLSNet serif
  card1: { x: 859, y: 356, w: 438, h: 368, stripY: 603 },
  card2: { x: 1331, y: 356, w: 438, h: 368, stripY: 604 },
  cardKickerFs: 44,
  cardNumFs: 120,
  cardStripFs: 30,
} as const;

// ─── Hex row scene (t=13.5) ───
export const HEXROW = {
  centers: [375, 765, 1155, 1545],
  cy: 340,
  hexW: 320,
  hexH: 290,
  box: { x: 823, y: 675, w: 274, h: 300, r: 40 },
  label: { y: 990, fs: 34 },
} as const;

// ─── Flows scene (t=15-18.5) ───
export const FLOWS = {
  // r6 probed: band y805-843 h~39 (was 819/22); ticks pitch 142.4 phase 56.5
  rulerY: 806,
  rulerH: 38,
  tickEvery: 142.4,
  tickX0: 56.5,
  stacks: [232, 420, 601, 1288], // stack center xs
  pillW: 62,
  pillH: 26,
  pillGap: 8,
  labelTop: { x: 1554, capTop: 712, fs: 112 },
  labelBot: { x: 1560, capTop: 856, fs: 112 },
} as const;

// ─── Globe scene ───
export const GLOBE = {
  cx: 960,
  cy: 539, // r6 probed: settled disc bbox y254-825 → cy 539.5 (was 550)
  r: 293,
  ringR: 335,
  lock: { x: 1430, y: 280, w: 260, h: 380 },
  triangle: { x: 961, y: 81 }, // r6 probed f486: x931-991 y81-133 (rides the slide)
} as const;

// ─── Map scenes ───
export const MAP = {
  x: 150,
  y: 60,
  w: 1650,
  h: 960,
  label: { x: 760, capTop: 972, fs: 64 },
  // mini hex placements (center x/y) with art keys
  hexes: [
    { art: "mHexHeli", cx: 375, cy: 405 },
    { art: "mHexOffice", cx: 755, cy: 230 },
    { art: "mHexBank", cx: 555, cy: 765 },
    { art: "mHexBank2", cx: 1105, cy: 425 },
    { art: "mHexTowers2", cx: 900, cy: 675 },
    { art: "mHexSail", cx: 1495, cy: 320 },
    { art: "mHexCity2", cx: 1460, cy: 715 },
  ],
  hexW: 215,
} as const;

// ─── Two-city scenes ───
export const CITIES = {
  line1: 398,
  line2: 998,
  cityA: { x: 335, y: 105, w: 1150, h: 295 },
  cityB: { x: 420, y: 455, w: 1190, h: 545 },
  smallScale: 0.62,
  aSmallCx: 560,
  bSmallCx: 1230,
  badgeA: { cx: 190, cy: 235, r: 42 },
  badgeB: { cx: 1728, cy: 905, r: 42 },
  pairFs: 84, // cap 58-60 measured at fr_1150
} as const;

// ─── Matching scene ───
export const MATCH = {
  hexA: { cx: 415, cy: 290, w: 230 },
  hexB: { cx: 1516, cy: 290, w: 230 },
  panel: { x: 776, y: 420, w: 405, h: 330 },
  box: { x: 768, y: 350, w: 155, h: 170, r: 24 },
  rows: [
    { swatch: "swatchBlue", label: "Unmatched" },
    { swatch: "orangeDeep", label: "Matched" },
  ],
  counts: {
    // measured checkpoints: [frame, unmatched, matched]
    keys: [
      [1495, 187, 110],
      [1552, 45, 252],
      [1585, 9, 288],
      [1615, 0, 298],
    ],
  },
  check: { cx: 1192, cy: 428, r: 42 },
} as const;

// ─── Day/night strip ───
// Gridlines probed at f2000/2050/2100: rate exactly 9.0 px/f, pitch 290.7,
// the "06:00" line at x=963 at f2000. Band re-measured r4: rows 502-577
// (#A8A8A8, not the gantt-ruler #D9D9D9) at f2030/2060/2095.
export const STRIP = {
  bandY: 502,
  bandH: 76,
  hourPx: 290.7, // h6→h9 span 872px at both f2000 and f2100
  rate: 9.0,
  anchorX: 963,
  anchorHour: 6,
  anchorF: 2000,
  labelDx: 43,
  labelTopY: 235,
  labelBotY: 880,
  fs: 30,
} as const;

// ─── Strip entry (r4, all measured) ───
// Ref enters via a band wipe + rotation, then the sheet slides in from the
// right decelerating into the steady 9px/f scroll:
//  1909-1930  white field (left) + navy field (right) sweep inward, each led
//             by a 76px grey stripe; stripes meet at x=974 at f1930 (stripe
//             centers tracked at 1914/1918/1922/1926 → d table below).
//  1930-1950  the vertical band rotates to horizontal about (974,540)
//             (tilt measured at 1934/1938/1942/1946: 0.4/4.7/25/79.5 deg).
//  1948-1978  sheet rides in: offset vs steady scroll from hour-line tracks
//             (line B sampled every frame 1959-1978; head extrapolated from
//             track A velocities 1954-1958). Zero from f1978.
export const STRIP_ENTRY = {
  pivotX: 974,
  wipeKeys: [1909, 1914, 1918, 1922, 1926, 1930],
  wipeD: [990, 875, 772, 567, 152, 0],
  rotKeys: [1930, 1934, 1938, 1942, 1946, 1950],
  rotDeg: [-90, -89.6, -85.3, -65, -10.5, 0],
  dxKeys: [1948, 1950, 1952, 1954, 1955, 1956, 1957, 1958, 1959, 1960, 1961, 1962, 1963, 1964, 1965, 1966, 1967, 1968, 1969, 1970, 1971, 1972, 1973, 1974, 1975, 1976, 1977, 1978],
  dxVals: [2450, 2043, 1640, 1262, 1093, 931, 787, 663, 558, 470, 395, 331, 277, 232, 193, 161, 135, 113, 95, 73, 54, 39, 26, 17, 9, 4, 1, 0],
} as const;

// Pill groups riding the strip (x in strip coords = screen x + rate*(f-2000)).
// r4: every rect re-measured (pills.py connected components on full-res
// frames); groups blink in/out — windows from region-mass lifecycle scans.
export type StripPill = {
  x: number; y: number; w: number; h: number; c: string;
  in?: readonly [number, number]; out?: readonly [number, number];
  fallKeys?: readonly [number, number]; fallY?: readonly [number, number];
};
export const STRIP_PILLS: StripPill[] = [
  // day A at h5.2-6.0 (fr_2000); lavender drops in from off-top (y76@1970,
  // y300@1974); whole group pops out 2004-2010
  { x: 731, y: 298, w: 94, h: 36, c: "#B4BCD3", out: [2004, 2010], fallKeys: [1967, 1974], fallY: [-92, 300] },
  { x: 730, y: 344, w: 224, h: 42, c: "#1A3E66", out: [2004, 2010] },
  { x: 728, y: 404, w: 150, h: 40, c: "#D1542F", out: [2004, 2010] },
  // day B at h7.8 (ref_2030), alive 2016-2070
  { x: 1440, y: 383, w: 97, h: 39, c: "#CB3F17", in: [2016, 2022], out: [2064, 2070] },
  { x: 1443, y: 432, w: 94, h: 37, c: "#ABB3CB", in: [2016, 2022], out: [2064, 2070] },
  // day C at h8.1-8.9 (ref_2075/2060 — the "sail" r2 traced was actually
  // these two pills), alive 2050-2106
  { x: 1571, y: 376, w: 224, h: 44, c: "#002753", in: [2050, 2054], out: [2098, 2106] },
  { x: 1570, y: 433, w: 231, h: 36, c: "#ABB3CB", in: [2050, 2054], out: [2098, 2106] },
  // night 18:00 group (fr_2000), alive 1990-2046
  { x: 1011, y: 720, w: 115, h: 34, c: "#FDFDFD", in: [1990, 1998], out: [2042, 2046] },
  { x: 1008, y: 772, w: 82, h: 35, c: "#CB3F17", in: [1990, 1998], out: [2042, 2046] },
  // night 19:00 trio (ref_2030), alive 2024-2070
  { x: 1282, y: 614, w: 84, h: 36, c: "#CB3F17", in: [2024, 2032], out: [2066, 2070] },
  { x: 1281, y: 684, w: 231, h: 36, c: "#ABB3CB", in: [2024, 2032], out: [2066, 2070] },
  { x: 1280, y: 862, w: 116, h: 37, c: "#CB3F17", in: [2024, 2032], out: [2066, 2070] },
  // night 21:00-ish trio (ref_2110), pops in 2088-2098, stays
  { x: 1948, y: 596, w: 82, h: 35, c: "#CB3F17", in: [2088, 2098] },
  { x: 1948, y: 641, w: 116, h: 35, c: "#FDFDFD", in: [2088, 2098] },
  { x: 1944, y: 688, w: 84, h: 36, c: "#CB3F17", in: [2088, 2098] },
  // night 22:00 lavender pair (ref_2125), pops in 2108-2118
  { x: 2139, y: 596, w: 231, h: 36, c: "#ABB3CB", in: [2108, 2118] },
  { x: 2140, y: 644, w: 116, h: 35, c: "#FDFDFD", in: [2108, 2118] },
];

// ─── Strip reprise (navy band) — measured regular_0218/0222/0226 ───
// Band y 405-680; scroll 9.76 px/f (cluster 1443→955→460 across f2725/2775/2825);
// CLSNet box FIXED at center; cluster inventory anchored at f2775.
export const STRIP2 = {
  bandY: 405,
  bandH: 275,
  rate: 9.76,
  anchorF: 2762, // regular_NNNN sits at (N-1)*0.5s — anchor corrected 13f earlier
  box: { x: 858, y: 437, w: 200 },
  ups: [
    { art: "rowBank", cx: -1228, scale: 0.95 },
    { art: "rowSail", cx: -373, scale: 0.85 }, // fr_2630: sail city at screen ~915
    { art: "stripTowerUp", cx: 955, scale: 1.15 },
    { art: "rowSail", cx: 2238, scale: 0.75 },
    { art: "rowOffice", cx: 3521 },
  ],
  dns: [
    { art: "stripInvSail", cx: -996 },
    { art: "stripInvCity", cx: 282 },
    { art: "stripInvBrick", cx: 1560 },
    { art: "stripInvSail", cx: 2838 },
  ],
  pills: [
    { x: 97, y: 593, w: 190, h: 52, c: "#C74D33" },
    { x: 385, y: 450, w: 100, h: 50, c: "#ABB1CC" },
  ],
} as const;

// ─── Report-out (netting reports leave CLSNet) — measured fr_2330/fr_2360 ───
export const REPORT = {
  docL: { x: 300, y: 315, w: 270, h: 345 },
  docR: { x: 1390, y: 315, w: 265, h: 345 },
  box: { x: 805, y: 350, w: 345 },
  panel: { x: 340, y: 470, w: 205, h: 120 }, // mini gantt inside docL
  vertLx: 355,
  vertRx: 1528,
  horizY: 547,
  driftY: 125, // whole group drifts +125px over 2332-2358 (fr_2330 vs fr_2360)
} as const;

// ─── Shield / ledge (probed zipper sweep + θ at fr_3708/3732/3762) ───
export const LEDGE = {
  center: [948, 575] as const, // band pivot; θ=90 reproduces the zipper at x928-968
  bandH: 40,
  tickEvery: 127,
  thetaKeys: [3690, 3700, 3708, 3732, 3762] as const,
  thetaVals: [90, 20, 7.1, -5.2, 0] as const,
  stacks: {
    baseline: 520, // pill bottoms (band top 555, 35px gap)
    pillW: 135,
    pillH: 62,
    pitch: 90,
    colGap: 175,
    leftX: 320,
    rightX: 1275,
  },
} as const;

// ─── Circle scene (fr_3350 / fr_3396 / fr_3460) ───
export const CIRCLE = {
  cx: 960,
  cy: 540,
  r: 460,
  dotR: 41,
  pillFrom: { x: 875, y: 505, w: 180, h: 92 },
  pillTo: { x: 790, y: 460, w: 350, h: 185 },
  whiteDot: { cx: 668, cy: 388, r: 42 },
  square: { x: 1237, y: 663, w: 73 },
} as const;

// ─── Gantt (row rects re-measured from fr_2172/fr_2300 color scans) ───
export const GANTT = {
  rulerY: 108,
  rulerX: 210,
  rulerW: 1500,
  rows: [
    { x: 212, y: 183, w: 134, color: "lavender" },
    { x: 249, y: 274, w: 369, color: "lavender" },
    { x: 500, y: 380, w: 165, color: "tan" },
    { x: 598, y: 470, w: 209, color: "orangeDeep" },
    { x: 724, y: 553, w: 338, color: "lavender" },
    { x: 957, y: 632, w: 162, color: "orangeDeep" },
    { x: 982, y: 715, w: 338, color: "lavender" },
    { x: 1208, y: 810, w: 179, color: "tan" },
    { x: 1313, y: 892, w: 112, color: "orangeDeep" },
  ],
  pillH: 50,
  labelFs: 28,
} as const;

// ─── Detail card ───
export const DETAIL = {
  card: { x: 540, y: 270, w: 756, h: 660, r: 20 },
  rowFs: 30,
  labelX: 580,
  valueX: 885,
} as const;

// ─── End card ───
export const ENDCARD = {
  logo: { x: 135, y: 78 },
  supporting: { x: 860, y: 283, fs: 38 },
  wordmark: { x: 128, capTop: 468 },
  disclaimer: { x: 130, y: 880, fs: 34 },
  urlBox: { x: 860, y: 864, w: 910, h: 100 },
  urlFs: 62,
} as const;

// ─── Mosaic (f3477-3645) — r5 ground truth ───
// Page windows measured by per-frame ink mass (seq scan 3479-3648); grids from
// scipy CC scans of settled frames 3505/3535/3560/3582. Three grey bars (tops
// 197/545/893, h8) draw L→R in cascade (extent keys probed per frame); four
// pill pages pop in/out on a fixed 7-column grid; after page 4 the bars
// converge to y549 (half-res track keys) and the merged bar rotates about
// (948,549) to vertical, becoming the shield scene's zipper.
// Cell grammar "above/below", tokens line-first:
//   B big blue 86×68 · S small blue 83×34 · O big orange 87×68 · T tan 83×35.
export const MOS = {
  lines: [197, 545, 893],
  cols: [74, 308, 526, 806, 1064, 1372, 1758],
  draw: [
    { f: [3478, 3479, 3480, 3481], x: [0, 760, 1582, 1920] },
    { f: [3480, 3481, 3482, 3483, 3484], x: [0, 372, 764, 1478, 1920] },
    { f: [3483, 3484, 3485, 3486, 3487, 3488], x: [0, 118, 340, 718, 1300, 1920] },
  ],
  // capTop values are pre-corrected for the Playfair render offset (measured
  // r5: passing X renders the cap 16px above X at fs138) — they RENDER at the
  // ref cap tops 94/441/789. Tracking 8px widens Playfair to the ref width.
  labelSlots: [
    { cx: 1482, capTop: 110 },
    { cx: 1010, capTop: 457 },
    { cx: 378, capTop: 805 },
  ],
  labelFs: 138,
  labelTracking: 8,
  orange: "#CC441E",
  tan: "#F0C8AF",
  converge: { f: [3606, 3610, 3613, 3615], l0: [201, 440, 530, 549], l2: [897, 640, 560, 549] },
  rotate: { f: [3615, 3620, 3628, 3636, 3642], deg: [0, 4.2, 15, 56, 90] },
  pages: [
    {
      in: 3487,
      out: 3514,
      labels: [["AED", "o"], ["RON", "w"], ["SAR", "o"]],
      rows: [
        "B/OT|S/|BS/|SS/OT|S/TT|/OT|BS/T",
        "S/T|BS/OT|B/O|/|/|SS/TT|S/T",
        "BS/O|/T|/OT|BS/TT|SS/T|BS/|S/OT",
      ],
    },
    {
      in: 3522,
      out: 3543,
      labels: [["CNH", "w"], ["RUB", "o"], ["THB", "o"]],
      rows: [
        "BS/T|S/|BS/|S/TT|SS/T|/TT|B/OT",
        "SS/TT|S/T|B/O|/|/|BS/OT|S/T",
        "S/OT|/T|/OT|SS/T|S/TT|SS/|BS/O",
      ],
    },
    {
      in: 3548,
      out: 3566,
      labels: [["CZK", "o"], ["SAR", "o"], ["TRY", "w"]],
      rows: [
        "B/OT|S/|BS/|SS/O|B/TT|/T|SS/TT",
        "SS/TT|S/T|B/O|/|/|SS/TT|BS/OT",
        "BS/O|/T|/OT|B/TT|SS/O|S/|SS/TT",
      ],
    },
    {
      in: 3571,
      out: 3589,
      labels: [["PLN", "w"], ["THB", "w"], ["AED", "o"]],
      rows: [
        "B/O|S/|BS/|SS/TT|S/T|/T|S/OT",
        "BS/OT|S/T|SS/TT|/|/|S/T|BS/OT",
        "B/O|/T|/OT|SS/TT|S/T|S/|BS/T",
      ],
    },
  ],
} as const;
