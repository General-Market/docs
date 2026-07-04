// Copy + measured values for the Axiom "Pulse" screen (plates f0392–f0417,
// base plate f0400 — the build is static at the f0400 state).
// Font: Inter (see the conclusion note in ./trenches.ts).
// Colors probed from f0400.

export const PCOLORS = {
  pageBg: "#101218",
  navBg: "#12151B",
  panelBg: "#14161D",
  cardBg: "#181B23",
  statBoxBg: "#262B33",
  statBoxBorder: "#3A3F49",
  tickerChipBg: "#1D1F2A",
  depositBg: "#444190",
  depositText: "#C9C5F1",
  dockBg: "#151820",
  dockBorder: "#2A2D38",
  notifBorder: "#5A55B8",
  textBright: "#F2F4F9",
  name: "#C8CBD5",
  sub: "#6E717E",
  label: "#5A5E6A",
  icon: "#6E717E",
  count: "#C8CBD5",
  green: "#73B0A5",
  greenMc: "#57B58E",
  teal: "#6FB8D9",
  red: "#C25A78",
  redBright: "#E0507A",
  yellow: "#D8CE5E",
  yellowNum: "#D9B845",
  orange: "#C98A4B", // "ZOOMING" / "Moe" sub-lines
  purple: "#7C78C9",
  purpleBright: "#8B87E0",
  agePurple: "#8286C8",
  ageBlue: "#5FA8D4", // "20s" on TING
  dsBlue: "#7377D0",
  cyan: "#61A4CF",
  addr: "#7C808C",
  goldRing: "#8A6D2F", // migrated avatar ring + underline
  hoverBg: "#1E1B2E", // Pumpwheel hovered row
  hoverText: "#8B87D8",
  badgeCheck: "#35B36B",
  paidGreen: "#4BC98F",
  timerRed: "#D84B6B",
} as const;

export const PNAV = {
  logo: "AXIOM",
  logoSuffix: "Pro",
  items: ["Discover", "Pulse", "Trackers", "Perpetuals", "Yield", "Vision", "Portfolio", "Rewards"],
  activeIndex: 1,
  notif: {
    avatar: "av-eight.png",
    who: "jsol",
    verb: "bought",
    what: "eight",
    line2Value: "1.631",
    line2Tail: "at $3K MC",
  },
  searchPlaceholder: "Search by token or CA...",
  searchSlash: "/",
  sol: "SOL",
  deposit: "Deposit",
  balance: "390.1",
  zero: "0",
} as const;

export type TickerEntry = { icon: string; label: string; cap: string; sol: string };

export const TICKER: TickerEntry[] = [
  { icon: "#B0512E", label: "MARS", cap: "$3.99K", sol: "13.010101 SOL" },
  { icon: "#E8E8E8", label: "SPAX", cap: "$6.42K", sol: "13.010101 SOL" },
  { icon: "#3C3F4A", label: "XXX", cap: "$6.38K", sol: "13.010101 SOL" },
  { icon: "#23252E", label: "STAR", cap: "$6.99K", sol: "13.010101 SOL" },
  { icon: "#17181E", label: "X", cap: "$261K", sol: "13.010101 SOL" },
  { icon: "#30323E", label: "X", cap: "$108K", sol: "13.010101 SOL" },
  { icon: "#2A2C36", label: "X", cap: "$5.45K", sol: "13.010101 SOL" },
  { icon: "#6B4A2E", label: "NETA...", cap: "$24.6K", sol: "13.010101 SOL" },
];

export const PHEADING = {
  title: "Pulse",
  presetChips: ["HODLER", "J7DEV", "DRILLIFY"],
  activePresets: [0, 2], // HODLER + DRILLIFY glow purple
  display: "Display",
  walletChip: "4",
  balanceChip: "322.3",
} as const;

export type PulseColumnHeader = { title: string; search: string; bolt: string; presets: string[]; activePreset: number; muted: boolean };

export const PULSE_HEADERS: PulseColumnHeader[] = [
  { title: "New Pairs", search: "Search by ticker or name", bolt: "9.00", presets: ["P1", "P2", "P3"], activePreset: 1, muted: true },
  { title: "Final Stretch", search: "Search by ticker or name", bolt: "8.00", presets: ["P1", "P2", "P3"], activePreset: 1, muted: true },
  { title: "Migrated", search: "Search by ticker or name", bolt: "10.00", presets: ["P1", "P2", "P3"], activePreset: 1, muted: false },
];

import type { IconToken, Badge } from "./trenches";

export type PulseCard = {
  name: string;
  sub: string;
  sub2?: { text: string; color: string };
  copyIcon: boolean; // the little copy glyph after the sub
  badges?: Badge[];
  keyBadge?: string; // GROKOFFICE "2" next to the key glyph
  avatar: string;
  age: string;
  ageColor?: string;
  timer?: { text: string; color: string };
  icons: IconToken[];
  people: string;
  bell: string;
  handle?: { text: string; color: string; num?: string };
  pct1: { v: string; color: string };
  pct1Skull?: boolean; // VISION's 70% skull marker
  pct2: { v: string; color: string };
  pct2Suffix: string;
  paid?: boolean; // Moe's "Paid" chip
  address: string;
  bar: { color: string; w: number };
  ring?: string; // gold avatar ring on migrated cards
  hovered?: boolean; // Pumpwheel row under the cursor
  stats: { v: string; mc: string; mcColor: string; chip1?: string; chip2?: string; single?: string };
};

const G = PCOLORS.green;

export const PULSE_NEW_PAIRS: PulseCard[] = [
  {
    name: "test", sub: "test", copyIcon: true, avatar: "av-test-pulse.png", age: "6s",
    icons: ["link", "clock", "search"], people: "2", bell: "227",
    pct1: { v: "4%", color: G }, pct2: { v: "3%", color: G }, pct2Suffix: "1mo",
    address: "4qR...pump", bar: { color: "#3E9E7C", w: 6 },
    stats: { v: "$108", mc: "$2.53K", mcColor: PCOLORS.teal, chip1: "4.3 SOL", chip2: "9.00 SOL" },
  },
  {
    name: "eight", sub: "eight", copyIcon: true, avatar: "av-eight.png", age: "8s",
    icons: ["globe", "link", "search"], people: "1", bell: "2",
    pct1: { v: "0%", color: G }, pct2: { v: "0%", color: G }, pct2Suffix: "1d",
    address: "3AP...pump", bar: { color: "#57B58E", w: 40 },
    stats: { v: "$824", mc: "$4.1K", mcColor: PCOLORS.teal, chip1: "4.3 SOL", chip2: "9.00 SOL" },
  },
  {
    name: "TING", sub: "testing", copyIcon: true,
    sub2: { text: "THING", color: PCOLORS.yellowNum },
    avatar: "av-ting.png", age: "20s", ageColor: PCOLORS.ageBlue,
    icons: ["link", "search"], people: "2", bell: "11",
    pct1: { v: "1%", color: G }, pct2: { v: "0%", color: G }, pct2Suffix: "~ 3mo",
    address: "CAG...pump", bar: { color: "#3E9E7C", w: 10 },
    stats: { v: "$24", mc: "$2.37K", mcColor: PCOLORS.teal, chip1: "4.3 SOL", chip2: "9.00 SOL" },
  },
  {
    name: "RAMADAN", sub: "RAMADAN", copyIcon: true, avatar: "av-ramadan.png", age: "26s",
    icons: ["feather", "link", "search"], people: "1", bell: "1",
    handle: { text: "@binance", color: PCOLORS.cyan, num: "15.6M" },
    pct1: { v: "2%", color: G }, pct2: { v: "2%", color: G }, pct2Suffix: "7m",
    address: "64f...pump", bar: { color: "#3E9E7C", w: 12 },
    stats: { v: "$209", mc: "$2.43K", mcColor: PCOLORS.teal, chip1: "4.3 SOL", chip2: "9.00 SOL" },
  },
  {
    name: "SIMS", sub: "Crypto Simulator", copyIcon: true, avatar: "av-sims.png", age: "27s",
    icons: ["person", "globe", "link", "search"], people: "0", bell: "1",
    handle: { text: "@CryptoSimsHQ", color: PCOLORS.cyan, num: "47" },
    pct1: { v: "0%", color: G }, pct2: { v: "DS", color: PCOLORS.dsBlue }, pct2Suffix: "3m",
    address: "2kH...pump", bar: { color: "#3E9E7C", w: 8 },
    stats: { v: "$197", mc: "$2.33K", mcColor: PCOLORS.teal, chip1: "4.3 SOL", chip2: "9.00 SOL" },
  },
  {
    name: "Cashback", sub: "Cashback Coin", copyIcon: true, avatar: "av-cashback.png", age: "27s",
    icons: ["link", "clock", "search"], people: "1", bell: "5,888",
    pct1: { v: "0%", color: G }, pct2: { v: "DS", color: PCOLORS.dsBlue }, pct2Suffix: "5mo",
    address: "5kQ...pump", bar: { color: "#3E9E7C", w: 30 },
    stats: { v: "$3K", mc: "$2.33K", mcColor: PCOLORS.teal, chip1: "4.3 SOL", chip2: "9.00 SOL" },
  },
  {
    name: "TST", sub: "Test", copyIcon: true, avatar: "av-tst.png", age: "27s",
    icons: ["link", "search"], people: "1", bell: "59",
    pct1: { v: "0%", color: G }, pct2: { v: "0%", color: G }, pct2Suffix: "7mo",
    address: "CTe...pump", bar: { color: "#3E9E7C", w: 12 },
    stats: { v: "$12", mc: "$2.35K", mcColor: PCOLORS.teal, chip1: "4.3 SOL", chip2: "9.00 SOL" },
  },
  {
    name: "test", sub: "test", copyIcon: true, avatar: "av-test-dog.png", age: "29s",
    icons: ["link", "search"], people: "0", bell: "1263",
    pct1: { v: "0%", color: G }, pct2: { v: "DS", color: PCOLORS.dsBlue }, pct2Suffix: "cope... 7mo",
    address: "5Jn...pump", bar: { color: "#3E9E7C", w: 8 },
    stats: { v: "$165", mc: "$2.33K", mcColor: PCOLORS.teal, chip1: "4.3 SOL", chip2: "9.00 SOL" },
  },
];

export const PULSE_FINAL_STRETCH: PulseCard[] = [
  {
    name: "Pumpwheel", sub: "The Pumpfun Flywheel", copyIcon: true, avatar: "av-pumpwheel.png",
    age: "6s", hovered: true,
    icons: ["link", "search"], people: "21", bell: "2005",
    pct1: { v: "58%", color: PCOLORS.redBright }, pct2: { v: "10%", color: G }, pct2Suffix: "10mo",
    address: "Bs2...f4JD", bar: { color: PCOLORS.purpleBright, w: 62 },
    stats: { v: "$7K", mc: "$34.2K", mcColor: PCOLORS.hoverText },
  },
  {
    name: "pumpwheel", sub: "pumpwheel", copyIcon: true, avatar: "av-pumpwheel.png", age: "9m",
    icons: ["link", "clock", "search"], people: "86", bell: "73",
    pct1: { v: "33%", color: PCOLORS.redBright }, pct2: { v: "DS", color: PCOLORS.dsBlue }, pct2Suffix: "3d",
    address: "Cxz...FaCr", bar: { color: "#57B58E", w: 44 },
    stats: { v: "$30K", mc: "$16.2K", mcColor: PCOLORS.yellow, chip1: "4.3 SOL", chip2: "8.00 SOL" },
  },
  {
    name: "G1", sub: "Chinese KungFu Robot", copyIcon: true,
    sub2: { text: "Chinese Kung Fu Robot", color: PCOLORS.orange },
    avatar: "av-g1.png", age: "1m",
    icons: ["grid", "globe", "link", "search"], people: "82", bell: "79",
    handle: { text: "by @TheCOD_Slayer", color: PCOLORS.cyan, num: "3.23K" },
    pct1: { v: "19%", color: PCOLORS.redBright }, pct2: { v: "DS", color: PCOLORS.dsBlue }, pct2Suffix: "9mo",
    address: "BCo...pump", bar: { color: "#4A4E5A", w: 30 },
    stats: { v: "$15K", mc: "$7.93K", mcColor: PCOLORS.teal, chip1: "4.3 SOL", chip2: "8.00 SOL" },
  },
  {
    name: "GROKOFFICE", sub: "Grok Office 4.2", copyIcon: true,
    badges: ["doc", "check"], keyBadge: "2",
    avatar: "av-grokoffice.png", age: "15m", ageColor: PCOLORS.agePurple,
    icons: ["featherOrange", "globe", "link", "search"], people: "83", bell: "1",
    handle: { text: "@conceptdev", color: PCOLORS.cyan, num: "355" },
    pct1: { v: "17%", color: PCOLORS.redBright }, pct2: { v: "2%", color: PCOLORS.ageBlue }, pct2Suffix: "18m",
    address: "146...pump", bar: { color: "#4A4E5A", w: 26 },
    stats: { v: "$23K", mc: "$7.9K", mcColor: PCOLORS.teal, chip1: "4.3 SOL", chip2: "8.00 SOL" },
  },
  {
    name: "Mia", sub: "Mia", copyIcon: true,
    sub2: { text: "My My", color: PCOLORS.orange },
    avatar: "av-mia.png", age: "18m", ageColor: PCOLORS.agePurple,
    icons: ["grid", "globe", "link", "search"], people: "46", bell: "4",
    handle: { text: "by @digitalcashjord", color: PCOLORS.cyan, num: "102" },
    pct1: { v: "25%", color: PCOLORS.redBright }, pct2: { v: "DS", color: PCOLORS.dsBlue }, pct2Suffix: "1d",
    address: "F2q...pump", bar: { color: "#4A4E5A", w: 30 },
    stats: { v: "$7K", mc: "$6.67K", mcColor: PCOLORS.teal, chip1: "4.3 SOL", chip2: "8.00 SOL" },
  },
  {
    name: "IDAREYOU", sub: "I DARE YOU", copyIcon: true, avatar: "av-idareyou.png",
    age: "25m", ageColor: PCOLORS.agePurple,
    icons: ["grid", "globe", "link", "search"], people: "55", bell: "1",
    handle: { text: "by @idareyousol", color: PCOLORS.cyan, num: "80" },
    pct1: { v: "14%", color: G }, pct2: { v: "DS", color: PCOLORS.dsBlue }, pct2Suffix: "30m",
    address: "XN6...pump", bar: { color: "#57B58E", w: 40 },
    stats: { v: "$16K", mc: "$6.42K", mcColor: PCOLORS.teal, chip1: "4.3 SOL", chip2: "8.00 SOL" },
  },
];

export const PULSE_MIGRATED: PulseCard[] = [
  {
    name: "VISION", sub: "Vision", copyIcon: true, avatar: "av-vision.png", age: "1m",
    ring: PCOLORS.goldRing,
    icons: ["grid", "link", "search"], people: "59", bell: "1",
    handle: { text: "by @SLEEPONYOURBAGS", color: PCOLORS.cyan, num: "4.8K" },
    pct1: { v: "4%", color: G }, pct1Skull: true,
    pct2: { v: "70%", color: PCOLORS.redBright }, pct2Suffix: "3h",
    address: "6n2...pump", bar: { color: PCOLORS.goldRing, w: 62 },
    stats: { v: "$14K", mc: "$46.3K", mcColor: PCOLORS.greenMc, single: "10.000000000 SOL" },
  },
  {
    name: "ZOOMER", sub: "ZOOMER", copyIcon: true,
    sub2: { text: "ZOOMING ZOOMING", color: PCOLORS.orange },
    avatar: "av-zoomer.png", age: "7m", ring: PCOLORS.goldRing,
    icons: ["xLogo", "globe", "telegram", "link", "search"], people: "254", bell: "1",
    pct1: { v: "7%", color: G }, pct2: { v: "DS", color: PCOLORS.dsBlue }, pct2Suffix: "30m",
    address: "R6a...pump", bar: { color: PCOLORS.goldRing, w: 62 },
    stats: { v: "$64K", mc: "$45.9K", mcColor: PCOLORS.greenMc, single: "10.000000000 SOL" },
  },
  {
    name: "NWHK", sub: "No War Having Kids", copyIcon: true, avatar: "av-nwhk.png",
    age: "8m", ring: PCOLORS.goldRing,
    icons: ["featherRed", "link", "search"], people: "1422", bell: "1",
    handle: { text: "@elonmusk", color: PCOLORS.cyan, num: "235M" },
    pct1: { v: "24%", color: PCOLORS.redBright }, pct2: { v: "DS", color: PCOLORS.dsBlue }, pct2Suffix: "2d",
    address: "rAc...pump", bar: { color: PCOLORS.goldRing, w: 62 },
    stats: { v: "$303K", mc: "$99.7K", mcColor: PCOLORS.greenMc, single: "10.000000000 SOL" },
  },
  {
    name: "Cashback", sub: "Cashback Coin", copyIcon: true, avatar: "av-cashback.png",
    age: "9m", ring: PCOLORS.goldRing,
    icons: ["link", "search"], people: "731", bell: "7480",
    pct1: { v: "21%", color: PCOLORS.redBright }, pct2: { v: "DS", color: PCOLORS.dsBlue }, pct2Suffix: "7mo",
    address: "E1X...pump", bar: { color: PCOLORS.goldRing, w: 62 },
    stats: { v: "$430K", mc: "$192K", mcColor: PCOLORS.greenMc, single: "10.000000000 SOL" },
  },
  {
    name: "TST", sub: "Test", copyIcon: true, avatar: "av-tst.png",
    age: "12m", ageColor: PCOLORS.agePurple, ring: PCOLORS.goldRing,
    icons: ["link", "search"], people: "2,151", bell: "31",
    pct1: { v: "13%", color: G }, pct2: { v: "DS", color: PCOLORS.dsBlue }, pct2Suffix: "2mo",
    address: "Hdv...pump", bar: { color: PCOLORS.goldRing, w: 62 },
    // last digit smeared on the plate: $655K vs $656K — went with 655 // UNREADABLE
    stats: { v: "$2.0M", mc: "$655K", mcColor: PCOLORS.greenMc, single: "10.000000000 SOL" },
  },
  {
    name: "TaxTime", sub: "Tax Refund", copyIcon: true, badges: ["check"],
    avatar: "av-taxtime.png", age: "19m", ageColor: PCOLORS.agePurple, ring: PCOLORS.goldRing,
    timer: { text: "10:02:41", color: PCOLORS.timerRed },
    icons: ["person", "link", "search"], people: "29", bell: "27",
    handle: { text: "@taxrefundmeme", color: PCOLORS.cyan, num: "34" },
    pct1: { v: "19%", color: PCOLORS.redBright }, pct2: { v: "DS", color: PCOLORS.dsBlue }, pct2Suffix: "17d",
    address: "71G...pump", bar: { color: PCOLORS.goldRing, w: 62 },
    stats: { v: "$3K", mc: "$45.6K", mcColor: PCOLORS.greenMc, single: "10.000000000 SOL" },
  },
  {
    name: "Moe", sub: "モエ", copyIcon: true,
    sub2: { text: "Moe", color: PCOLORS.orange },
    avatar: "av-moe.png", age: "19m", ageColor: PCOLORS.agePurple, ring: PCOLORS.goldRing,
    icons: ["grid", "link", "search"], people: "291", bell: "1",
    handle: { text: "by @joon0x", color: PCOLORS.cyan, num: "263" },
    pct1: { v: "24%", color: PCOLORS.redBright }, pct2: { v: "DS", color: PCOLORS.dsBlue }, pct2Suffix: "21m",
    paid: true,
    address: "AEt...pump", bar: { color: PCOLORS.goldRing, w: 62 },
    stats: { v: "$186K", mc: "$26K", mcColor: PCOLORS.yellow, single: "10.000000000 SOL" },
  },
  {
    // bottom card, mostly hidden behind the docked trades panel
    name: "BLOODNUT", sub: "red ruffed lemur", copyIcon: true, badges: ["doc"],
    avatar: "av-bloodnut.png", age: "", ring: PCOLORS.goldRing,
    icons: [], people: "", bell: "",
    pct1: { v: "", color: G }, pct2: { v: "", color: G }, pct2Suffix: "",
    address: "", bar: { color: PCOLORS.goldRing, w: 0 },
    stats: { v: "$157K", mc: "$105K", mcColor: PCOLORS.greenMc, single: "10.000000000 SOL" },
  },
];

export const PAID_CHIP = "Paid" as const;

export const DOCK = {
  owner: "Jason",
  tabs: ["Manager", "Trades", "Monitor"],
  activeTab: 1, // "Trades" (white, red dot); Monitor also carries a red dot
  preset: "P3",
  bolt: "13.010",
  columns: ["Name", "Token", "Amount", "$MC"],
} as const;
