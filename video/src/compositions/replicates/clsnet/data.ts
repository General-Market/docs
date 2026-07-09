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
  strip: [1930, 2212],
  gantt: [2212, 2290],
  reportOut: [2290, 2372],
  handshake: [2372, 2480],
  payment: [2480, 2612],
  strip2: [2612, 2822],
  reportCard: [2822, 2990],
  buildPop: [2990, 3104],
  mapBadges: [3104, 3290],
  implode: [3290, 3364],
  circle: [3364, 3480],
  mosaic: [3480, 3688],
  shield: [3688, 3762],
  ledge: [3762, 3822],
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
  pairSchedule: { top: string; bottom: string; from: number }[];
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
  // currency pair schedule during SEG.pairs (top label above line1-right,
  // bottom label mirrored below; second city shows inverse pair)
  pairSchedule: [
    { top: "USD", bottom: "CNH", from: 1040 },
    { top: "EUR", bottom: "RUB", from: 1140 },
    { top: "EUR", bottom: "PLN", from: 1195 },
    { top: "EUR", bottom: "CZK", from: 1250 },
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
  rulerY: 819,
  rulerH: 22,
  tickEvery: 137,
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
  cy: 550,
  r: 293,
  ringR: 335,
  lock: { x: 1430, y: 280, w: 260, h: 380 },
  triangle: { x: 960, y: 148 },
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
  pairFs: 74,
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
export const STRIP = {
  bandY: 504,
  bandH: 64,
  hourPx: 286, // px per hour on the strip (measured label spacing)
  labelTopY: 235,
  labelBotY: 880,
  fs: 30,
} as const;

// ─── Gantt ───
export const GANTT = {
  rulerY: 108,
  rulerX: 210,
  rulerW: 1500,
  rows: [
    { x: 211, y: 200, w: 160, color: "lavender" },
    { x: 251, y: 275, w: 355, color: "lavender" },
    { x: 465, y: 350, w: 165, color: "tan" },
    { x: 545, y: 425, w: 215, color: "orangeDeep" },
    { x: 680, y: 500, w: 330, color: "lavender" },
    { x: 855, y: 575, w: 175, color: "orangeDeep" },
    { x: 940, y: 650, w: 345, color: "lavender" },
    { x: 1190, y: 725, w: 175, color: "tan" },
    { x: 1305, y: 800, w: 175, color: "orangeDeep" },
  ],
  pillH: 44,
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
