// Copy + measured values for the Axiom "Trenches" screen (plates f0000–f0332).
//
// FONT CONCLUSION: the UI face matches Inter — double-story lowercase "a",
// curved-foot "t", lining tabular digits, tight semibold caps ("Trenches",
// "Migrated") all line up with Inter 400/500/600/700 at the measured sizes.
// Loaded via @remotion/google-fonts/Inter in the screen components.
//
// Every color below was probed from plate f0300 (top-5 brightest pixels of
// each glyph region / flat-region single pixels). Geometry is f0300-nominal
// 1920×1080. The whole screen rides an editor zoom measured by OpenCV
// template matching against f0300 (see ZOOM_TABLE at the bottom).

export const COLORS = {
  pageBg: "#090C11",
  panelBg: "#1A1D24",
  panelGap: "#080B10",
  cardDivider: "rgba(255,255,255,0.05)",
  navBg: "#0A0D12",
  searchBg: "#12151B",
  chipBg: "#22252E",
  box1Border: "#565A64", // bright border of the empty left stat box
  box2Bg: "#1D202A",
  box2Border: "#30333E",
  textBright: "#F2F4F9",
  name: "#C8CBD5",
  sub: "#6E717E",
  label: "#5A5E6A", // the V / MC / F letters
  icon: "#6E717E",
  count: "#C8CBD5",
  green: "#73B0A5", // ages + positive %
  greenBar: "#3E9E7C",
  teal: "#6FB8D9", // MC values (low caps)
  red: "#C25A78",
  yellow: "#D8CE5E", // yellow MC values
  yellowNum: "#D9B845", // handle-follower numbers, "18.8k"
  purple: "#7C78C9", // active nav item
  agePurple: "#8286C8", // "12m"/"14m" style ages in Migrated
  dsBlue: "#7377D0",
  cyan: "#61A4CF", // "by @handle" rows
  addr: "#7C808C",
  greenMc: "#57B58E",
  toastBg: "#171A22",
  toastBorder: "#2C2F3A",
  badgeWarn: "#E5A50A",
  badgeDoc: "#D9A441",
  badgeCheck: "#35B36B",
  timerGreen: "#57B58E",
} as const;

export const NAV = {
  items: ["Trenches", "Trending", "Portfolio", "Track", "Rewards"],
  activeIndex: 0,
  pasteCa: "Paste CA",
  searchPlaceholder: "Search by name or CA...",
  searchSlash: "/",
  // wallet strip behind the toasts (visible until f294)
  chips: { wallet: "4", mid: "333", right: "401" },
} as const;

export const HEADING = {
  title: "Trenches",
  beta: "beta",
} as const;

export type ColumnHeader = {
  title: string;
  paused: boolean;
  soonChip: boolean; // the [◎|MC] chip only on "Soon"
  search: string;
  bolt: string;
  preset: string;
};

export const COLUMN_HEADERS: ColumnHeader[] = [
  { title: "New", paused: true, soonChip: false, search: "Search", bolt: "8", preset: "P2" },
  { title: "Soon", paused: false, soonChip: true, search: "Search", bolt: "8.2", preset: "P1" },
  { title: "Migrated", paused: false, soonChip: false, search: "Search", bolt: "15", preset: "P1" },
];

export const RIGHT_CONTROLS = { customize: "Customize" } as const;

// stat-box letter labels, shared with the Pulse screen
export const STAT_LABELS = { v: "V", mc: "MC", f: "F" } as const;

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export type AgeSample = { f: number; v: string };

export type IconToken =
  | "link" | "search" | "globe" | "pill" | "feather" | "featherRed" | "featherOrange"
  | "clock" | "person" | "personYellow" | "peopleGroup" | "sCircle" | "atCircle"
  | "fire" | "telegram" | "xLogo" | "grid";

export type Badge = "warn" | "doc" | "check";

export type TrenchCard = {
  name: string;
  sub: string;
  sub2?: { text: string; color: string };
  badges?: Badge[];
  avatar: string; // file under realist-assets/ui/
  ages: AgeSample[]; // sampled at f60 / f180 / f300
  ageColor?: string; // defaults to COLORS.green
  timer?: string; // TaxTime countdown chip
  icons: IconToken[];
  people: string;
  bell: string;
  handle?: { text: string; color: string; num?: string; num2?: string; num2Color?: string };
  pct1: { v: string; color: string };
  pct2: { v: string; color: string };
  pct2Suffix: string; // "1mo" / "DS 9mo" style tail rendered after crown value
  midRows?: { label: string; value: string; valueColor: string }[]; // B. Curve / ATH
  address: string;
  bar: { color: string; w: number }; // progress fill px of the 62px rail (measured f0300)
  stats: {
    v: string;
    mc: string;
    mcColor: string;
    f: string;
    chip1: string; // left box lightning chip
    chip2: string; // right box lightning chip
  };
  // stepped value changes read off the plates (last step with at <= frame wins)
  statSteps?: { at: number; v?: string; mc?: string; mcColor?: string; fee?: string }[];
};

const G = COLORS.green;
const R = COLORS.red;

export const NEW_CARDS: TrenchCard[] = [
  {
    name: "test", sub: "test", avatar: "av-test.png",
    ages: [{ f: 60, v: "1s" }, { f: 180, v: "1s" }, { f: 300, v: "2s" }],
    icons: ["link", "search"], people: "2", bell: "226",
    pct1: { v: "4%", color: G }, pct2: { v: "3%", color: G }, pct2Suffix: "1mo",
    midRows: [
      { label: "B. Curve", value: "14.97%", valueColor: COLORS.greenMc },
      { label: "ATH", value: "14.97%", valueColor: "#8A8D99" },
    ],
    address: "4qR...pump", bar: { color: COLORS.greenBar, w: 5 },
    stats: { v: "$85", mc: "$2.5K", mcColor: COLORS.teal, f: "0", chip1: "4.30", chip2: "8.00" },
    statSteps: [{ at: 232, v: "$110" }],
  },
  {
    name: "Pumpwheel", sub: "The Pumpfun Flywheel", avatar: "av-pumpwheel.png",
    ages: [{ f: 60, v: "1s" }, { f: 180, v: "1s" }, { f: 300, v: "2s" }],
    icons: ["link", "sCircle", "search"], people: "2", bell: "2,014",
    pct1: { v: "14%", color: G }, pct2: { v: "10%", color: G }, pct2Suffix: "10mo",
    address: "Bs2...f4jD", bar: { color: COLORS.teal, w: 10 },
    stats: { v: "$275", mc: "$2.8K", mcColor: COLORS.teal, f: "0", chip1: "4.30", chip2: "8.00" },
    statSteps: [{ at: 232, v: "$399", mc: "$2.9K", fee: "0.034" }],
  },
  {
    name: "eight", sub: "eight", avatar: "av-eight.png",
    ages: [{ f: 60, v: "4s" }, { f: 180, v: "4s" }, { f: 300, v: "5s" }],
    icons: ["globe", "link", "search"], people: "2", bell: "2",
    pct1: { v: "0%", color: G }, pct2: { v: "0%", color: G }, pct2Suffix: "1d",
    address: "3AP...pump", bar: { color: COLORS.greenBar, w: 3 },
    stats: { v: "$8.2", mc: "$2.3K", mcColor: COLORS.teal, f: "0", chip1: "4.30", chip2: "8.00" },
  },
  {
    name: "TING", sub: "testing", avatar: "av-ting.png",
    ages: [{ f: 60, v: "16s" }, { f: 180, v: "16s" }, { f: 300, v: "17s" }],
    icons: ["link", "search"], people: "2", bell: "11",
    pct1: { v: "1%", color: G }, pct2: { v: "0%", color: G }, pct2Suffix: "3mo",
    address: "CAG...pump", bar: { color: COLORS.greenBar, w: 0 },
    stats: { v: "$18", mc: "$2.3K", mcColor: COLORS.teal, f: "0", chip1: "4.30", chip2: "8.00" },
    statSteps: [{ at: 308, v: "$24", mc: "$2.4K" }],
  },
  {
    name: "SIMS", sub: "Crypto Simulator", avatar: "av-sims.png",
    ages: [{ f: 60, v: "22s" }, { f: 180, v: "22s" }, { f: 300, v: "23s" }],
    icons: ["person", "globe", "link", "search"], people: "0", bell: "1",
    handle: { text: "@cryptosimshq", color: "#AEB1B7", num: "18" },
    pct1: { v: "0%", color: G }, pct2: { v: "DS", color: COLORS.dsBlue }, pct2Suffix: "3m",
    address: "2kH...pump", bar: { color: COLORS.greenBar, w: 5 },
    stats: { v: "$198", mc: "$2.4K", mcColor: COLORS.teal, f: "0", chip1: "4.30", chip2: "8.00" },
  },
  {
    name: "RAMADAN", sub: "RAMADAN", badges: ["doc"], avatar: "av-ramadan.png",
    ages: [{ f: 60, v: "22s" }, { f: 180, v: "22s" }, { f: 300, v: "23s" }],
    icons: ["feather", "link", "search"], people: "1", bell: "1",
    handle: { text: "@binance", color: "#AEB1B7", num: "15.6m" },
    pct1: { v: "2%", color: G }, pct2: { v: "2%", color: G }, pct2Suffix: "7m",
    address: "54f...pump", bar: { color: COLORS.greenBar, w: 0 },
    stats: { v: "$209", mc: "$2.5K", mcColor: COLORS.teal, f: "0", chip1: "4.30", chip2: "8.00" },
  },
  {
    name: "Cashback", sub: "Cashback Coin", avatar: "av-cashback.png",
    ages: [{ f: 60, v: "23s" }, { f: 180, v: "23s" }, { f: 300, v: "24s" }],
    icons: ["link", "clock", "search"], people: "3", bell: "5,782",
    pct1: { v: "11%", color: G }, pct2: { v: "DS", color: COLORS.dsBlue }, pct2Suffix: "5mo",
    address: "5kQ...pump", bar: { color: COLORS.greenBar, w: 6 },
    stats: { v: "$2.8K", mc: "$3.1K", mcColor: COLORS.teal, f: "0.240", chip1: "4.30", chip2: "8.00" },
    statSteps: [{ at: 285, mc: "$3.0K" }],
  },
  {
    name: "TST", sub: "Test", avatar: "av-tst.png",
    ages: [{ f: 60, v: "23s" }, { f: 180, v: "23s" }, { f: 300, v: "24s" }],
    icons: ["link", "search"], people: "2", bell: "59",
    pct1: { v: "0%", color: G }, pct2: { v: "0%", color: G }, pct2Suffix: "7mo",
    address: "CTe...pump", bar: { color: COLORS.greenBar, w: 0 },
    stats: { v: "$12", mc: "$2.3K", mcColor: COLORS.teal, f: "0", chip1: "4.30", chip2: "8.00" },
  },
];

export const SOON_CARDS: TrenchCard[] = [
  {
    name: "G1", sub: "Chinese KungFu Robot", avatar: "av-g1.png",
    ages: [{ f: 60, v: "1m" }, { f: 180, v: "1m" }, { f: 300, v: "1m" }],
    icons: ["feather", "peopleGroup", "link", "search"], people: "83", bell: "79",
    handle: { text: "18.8k", color: COLORS.yellowNum },
    pct1: { v: "19%", color: R }, pct2: { v: "DS", color: COLORS.dsBlue }, pct2Suffix: "9mo",
    address: "BCo...pump", bar: { color: COLORS.greenBar, w: 45 },
    stats: { v: "$15K", mc: "$7.9K", mcColor: COLORS.teal, f: "3.16", chip1: "4.30", chip2: "8.20" },
  },
  {
    name: "BALDI", sub: "BALDI", badges: ["warn", "doc", "check"], avatar: "av-baldi.png",
    ages: [{ f: 60, v: "1m" }, { f: 180, v: "1m" }, { f: 300, v: "1m" }],
    icons: ["personYellow", "globe", "link", "search"], people: "34", bell: "1",
    handle: { text: "@funbaldi", color: "#AEB1B7", num: "70" },
    pct1: { v: "34%", color: R }, pct2: { v: "0%", color: G }, pct2Suffix: "~ 16m",
    address: "vRp...pump", bar: { color: COLORS.teal, w: 0 },
    stats: { v: "$2.5K", mc: "$6.8K", mcColor: COLORS.teal, f: "0.021", chip1: "4.30", chip2: "8.20" },
    statSteps: [{ at: 232, v: "$2.6K", mc: "$6.9K" }],
  },
];

export const MIGRATED_CARDS: TrenchCard[] = [
  {
    name: "IPR", sub: "Infinite Pump Rewards", badges: ["warn", "doc"], avatar: "av-ipr.png",
    ages: [{ f: 60, v: "4m" }, { f: 180, v: "4m" }, { f: 300, v: "5m" }],
    icons: ["fire", "link", "clock", "search"], people: "18", bell: "4,024",
    handle: { text: "@shibes031", color: "#AEB1B7", num: "115" },
    pct1: { v: "12%", color: G }, pct2: { v: "DS", color: COLORS.dsBlue }, pct2Suffix: "1mo",
    address: "8pU...pump", bar: { color: COLORS.greenBar, w: 62 },
    stats: { v: "$66K", mc: "$1.9K", mcColor: COLORS.teal, f: "7.42", chip1: "4.30", chip2: "15.00" },
  },
  {
    name: "ZOOMER", sub: "ZOOMER", avatar: "av-zoomer.png",
    ages: [{ f: 60, v: "7m" }, { f: 180, v: "7m" }, { f: 300, v: "7m" }],
    icons: ["globe", "telegram", "link", "search"], people: "255", bell: "1",
    pct1: { v: "10%", color: G }, pct2: { v: "DS", color: COLORS.dsBlue }, pct2Suffix: "30m",
    address: "R6a...pump", bar: { color: COLORS.greenBar, w: 62 },
    stats: { v: "$64K", mc: "$44K", mcColor: COLORS.yellow, f: "1.07", chip1: "4.30", chip2: "15.00" },
  },
  {
    name: "NWHK", sub: "No War Having Kids", avatar: "av-nwhk.png",
    ages: [{ f: 60, v: "8m" }, { f: 180, v: "8m" }, { f: 300, v: "8m" }],
    icons: ["featherRed", "link", "search"], people: "1,429", bell: "1",
    handle: { text: "@elonmusk", color: "#AEB1B7", num: "234.7m" },
    pct1: { v: "25%", color: R }, pct2: { v: "DS", color: COLORS.dsBlue }, pct2Suffix: "2d",
    address: "rAc...pump", bar: { color: COLORS.greenBar, w: 62 },
    stats: { v: "$301K", mc: "$100K", mcColor: COLORS.greenMc, f: "0.855", chip1: "4.30", chip2: "15.00" },
    statSteps: [{ at: 278, mc: "$98K", mcColor: COLORS.yellow }, { at: 308, mc: "$99K", fee: "0.857" }],
  },
  {
    name: "Cashback", sub: "Cashback Coin", avatar: "av-cashback.png",
    ages: [{ f: 60, v: "9m" }, { f: 180, v: "9m" }, { f: 300, v: "9m" }],
    icons: ["link", "search"], people: "707", bell: "7,330",
    pct1: { v: "21%", color: R }, pct2: { v: "DS", color: COLORS.dsBlue }, pct2Suffix: "7mo",
    address: "E1X...pump", bar: { color: COLORS.greenBar, w: 62 },
    stats: { v: "$421K", mc: "$184K", mcColor: COLORS.greenMc, f: "46.03", chip1: "4.30", chip2: "15.00" },
    statSteps: [{ at: 278, v: "$422K", mc: "$182K", fee: "46.11" }, { at: 308, v: "$423K", mc: "$195K", fee: "46.22" }],
  },
  {
    name: "TST", sub: "Test", avatar: "av-tst.png",
    ages: [{ f: 60, v: "12m" }, { f: 180, v: "12m" }, { f: 300, v: "12m" }],
    ageColor: "#8286C8",
    icons: ["link", "atCircle", "search"], people: "2,158", bell: "29",
    pct1: { v: "14%", color: G }, pct2: { v: "DS", color: COLORS.dsBlue }, pct2Suffix: "2mo",
    address: "Hdv...pump", bar: { color: COLORS.greenBar, w: 62 },
    stats: { v: "$2.0M", mc: "$620K", mcColor: COLORS.greenMc, f: "160.89", chip1: "4.30", chip2: "15.00" },
    statSteps: [{ at: 278, mc: "$624K", fee: "160.98" }, { at: 308, mc: "$636K", fee: "161.02" }],
  },
  {
    name: "$1Maya", sub: "The One Dog", avatar: "av-maya.png",
    ages: [{ f: 60, v: "14m" }, { f: 180, v: "14m" }, { f: 300, v: "14m" }],
    ageColor: "#8286C8",
    icons: ["peopleGroup", "link", "clock", "search"], people: "52", bell: "1",
    handle: { text: "by @saidelmasew", color: COLORS.cyan, num: "39", num2: "22", num2Color: "#D84B4B" },
    pct1: { v: "7%", color: G }, pct2: { v: "DS", color: COLORS.dsBlue }, pct2Suffix: "22m",
    address: "4Yc...pump", bar: { color: COLORS.greenBar, w: 62 },
    stats: { v: "$75K", mc: "$1.7K", mcColor: COLORS.teal, f: "1.84", chip1: "4.30", chip2: "15.00" },
  },
  {
    name: "luckycat", sub: "幸运猫", // 幸运猫
    sub2: { text: "Lucky Cat", color: COLORS.yellowNum },
    avatar: "av-luckycat.png",
    ages: [{ f: 60, v: "16m" }, { f: 180, v: "16m" }, { f: 300, v: "16m" }],
    ageColor: "#8286C8",
    icons: ["peopleGroup", "globe", "link", "search"], people: "55", bell: "1,430",
    handle: { text: "by @Gladey777", color: COLORS.cyan, num: "1.9k", num2: "3009", num2Color: "#D84B4B" },
    pct1: { v: "12%", color: G }, pct2: { v: "DS", color: COLORS.dsBlue }, pct2Suffix: "6mo",
    address: "8oG...aTbp", bar: { color: COLORS.greenBar, w: 62 },
    stats: { v: "$87K", mc: "$2.0K", mcColor: COLORS.teal, f: "11.52", chip1: "4.30", chip2: "15.00" },
  },
  {
    name: "TaxTime", sub: "Tax Refund", badges: ["check"], avatar: "av-taxtime.png",
    ages: [{ f: 60, v: "19m" }, { f: 180, v: "19m" }, { f: 300, v: "19m" }],
    ageColor: "#8286C8",
    timer: "10:02:44",
    icons: ["person", "link", "search"], people: "32", bell: "22",
    handle: { text: "@taxrefundmeme", color: "#AEB1B7" },
    pct1: { v: "19%", color: R }, pct2: { v: "DS", color: COLORS.dsBlue }, pct2Suffix: "17d",
    address: "71G...pump", bar: { color: COLORS.greenBar, w: 62 },
    stats: { v: "$2.9K", mc: "$57K", mcColor: COLORS.yellow, f: "0.268", chip1: "4.30", chip2: "15.00" },
  },
];

// ---------------------------------------------------------------------------
// "Executing orders" toasts (top-right). Measured fade-ins on the plates:
// toast 1 starts f294 (settled ~f301), toast 2 stacks below from f307
// (settled ~f313). Both carry identical copy.
// ---------------------------------------------------------------------------

export const TOAST = {
  title: "Executing orders",
  buyPrefix: "Buy",
  coin: "Pumpwheel",
  buySuffix: "for 8 SOL",
  counts: [
    { label: "Waiting", value: "4" },
    { label: "Success", value: "0" },
    { label: "Error", value: "0" },
  ],
  toast1AppearFrame: 294,
  toast2AppearFrame: 307,
  fadeFrames: 7,
} as const;

// ---------------------------------------------------------------------------
// Editor zoom: frame = s · base + t, base = f0300 geometry.
// Measured with cv2.matchTemplate (TM_CCOEFF_NORMED, scales 0.95…1.55) on two
// templates ("Trenches" heading + "Migrated" column title); the f80–f165
// window used the heading template alone (the other slid off-screen) and was
// smoothed. Confidence ≥ 0.95 on all pair-solved samples.
// ---------------------------------------------------------------------------

export type ZoomKey = { f: number; s: number; tx: number; ty: number };

export const ZOOM_TABLE: ZoomKey[] = [
  { f: 0, s: 1.0, tx: 0, ty: 0 },
  { f: 15, s: 1.007, tx: 0, ty: 0.2 },
  { f: 20, s: 1.0128, tx: 1.0, ty: 0 },
  { f: 25, s: 1.0241, tx: 0.7, ty: 0.3 },
  { f: 30, s: 1.0412, tx: 1.9, ty: 0.3 },
  { f: 35, s: 1.072, tx: 3.6, ty: -0.1 },
  { f: 40, s: 1.1269, tx: 6.5, ty: 0.7 },
  { f: 45, s: 1.1942, tx: 9.9, ty: 1.1 },
  { f: 50, s: 1.2444, tx: 12.2, ty: 0.9 },
  { f: 55, s: 1.2798, tx: 14.0, ty: 1.4 },
  { f: 60, s: 1.3054, tx: 15.6, ty: 2.0 },
  { f: 65, s: 1.3245, tx: 16.7, ty: 2.3 },
  { f: 70, s: 1.3389, tx: 17.6, ty: 2.2 },
  { f: 75, s: 1.3494, tx: 18.3, ty: 2.0 },
  { f: 85, s: 1.362, tx: 18.6, ty: 2.4 },
  // plateau refit by direct SSIM affine search against plates (r4):
  { f: 90, s: 1.369, tx: 17.7, ty: 2.5 },
  { f: 120, s: 1.373, tx: 17.8, ty: 2.6 },
  { f: 150, s: 1.3655, tx: 18.7, ty: 2.5 },
  { f: 160, s: 1.358, tx: 18.5, ty: 2.3 },
  { f: 170, s: 1.3459, tx: 17.1, ty: 1.9 },
  { f: 175, s: 1.3354, tx: 16.8, ty: 2.1 },
  { f: 180, s: 1.3226, tx: 16.3, ty: 1.5 },
  { f: 185, s: 1.3058, tx: 15.6, ty: 1.9 },
  { f: 190, s: 1.2848, tx: 14.1, ty: 1.8 },
  { f: 195, s: 1.256, tx: 13.3, ty: 2.1 },
  { f: 200, s: 1.2179, tx: 11.2, ty: 1.9 },
  { f: 205, s: 1.1662, tx: 8.5, ty: 0.7 },
  { f: 210, s: 1.1132, tx: 5.5, ty: 0.7 },
  { f: 215, s: 1.0759, tx: 3.8, ty: 0.4 },
  { f: 220, s: 1.0521, tx: 3.1, ty: 0.1 },
  { f: 225, s: 1.037, tx: 1.7, ty: 0.3 },
  { f: 230, s: 1.0257, tx: 1.6, ty: 0.6 },
  { f: 235, s: 1.0175, tx: 1.2, ty: 0.5 },
  // tail ty refit by SSIM affine search (plates settle ~1px lower):
  { f: 240, s: 1.0121, tx: 0.6, ty: 0.6 },
  { f: 245, s: 1.0078, tx: 0.4, ty: 0.7 },
  { f: 250, s: 1.0047, tx: 0.1, ty: 0.8 },
  { f: 255, s: 1.0023, tx: 0.3, ty: 0.9 },
  { f: 260, s: 1.0012, tx: 0, ty: 1.0 },
  { f: 270, s: 1.0, tx: 0, ty: 1.0 },
  { f: 332, s: 1.0, tx: 0, ty: 1.0 },
];

export const ageAt = (samples: AgeSample[], frame: number): string => {
  let v = samples[0].v;
  for (const s of samples) {
    if (frame >= s.f) v = s.v;
  }
  return v;
};
