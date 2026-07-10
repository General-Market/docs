// cls-day replica — measured data module. Every color, string, position and
// timing in the replica reads from here. Frames are 25fps against
// public/cls-day-original.mp4 (1920×1080, 3750f, 150s).
//
// Measurement provenance: per-pixel probes + crops of
// .claude/rounds/work/cls-day/analysis/frames/regular_NNNN.png where
// regular_N sits at t=(N-1)*0.5s → ref frame (N-1)*12.5.

export const FPS = 25;
export const DURATION = 3750;
export const W = 1920;
export const H = 1080;

// ─── Palette (probed) ───
export const C = {
  navyBg: "#002753", // intro/end card + dark panels (probe r0006 @960,140)
  navyInk: "#12365E", // headline navy text (07:00 / big time labels)
  navyDeep: "#0B2341", // timeline ticks / thin line art
  red: "#CC441E", // serif currency red / red line art
  marker: "#D1451E", // timeline marker triangle + milestone lines
  bandGrey: "#D7D7D7", // timeline band strip
  white: "#FDFDFD", // page background
  blue: "#4CA0D3", // globe fill / donut scene bg / gantt fill
  skyBlue: "#2E96D6", // "Trade executed" arrows + small blue labels
  chipGrey: "#8B9DAF",
  chipCream: "#F2C7A9",
  chipNavy: "#0E2C50",
  chipRed: "#CC441E",
  donutGrey: "#D9D9D9",
} as const;

// ─── Fonts ───
// UI text is Helvetica across the reference (bold digits + regular labels).
// Currency codes / percentages / "8.0+" are a high-contrast transitional
// serif — Georgia is the closest deterministic system face (A/B'd).
export const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
export const SERIF = "Georgia, 'Times New Roman', serif";

// ─── Timeline band geometry (probed on regular_0149) ───
// Grey strip y88..128 (40px). Hour ticks are navy verticals from y84 to
// y148; labels sit left-aligned 8px right of the tick, ~30px Helvetica.
export const BAND = {
  y: 88,
  h: 40,
  tickTop: 84,
  tickBottom: 148,
  labelY: 132, // label box top
  labelSize: 30,
  pxPerHour: 141.6,
};

// ─── Scene table (frames @25fps) ───
// Soft transitions; hard cuts only at f674, f1466, f3561 (ffmpeg scene
// detect >0.18).
export const SCENES = {
  intro: { from: 0, to: 112 }, // navy logo card, wipe out 100..112
  currencies: { from: 100, to: 300 }, // white, serif pairs + chips + ruler
  globe: { from: 300, to: 460 }, // globe clock + padlock
  trade: { from: 460, to: 674 }, // hexagons + CLS pill
  skyline: { from: 674, to: 940 }, // banded skyline, cut in at f674; rises into S6 f920..940
  schedule: { from: 923, to: 1176 }, // navy sweep-in, 00:00 pay-in schedule; zoom-out via doc bar
  netting: { from: 1170, to: 1466 }, // blue bg (the zoomed bar), donuts 0→96→99%
  revised: { from: 1466, to: 1700 }, // white, 06:30 revised schedule
  zoomTimes: { from: 1700, to: 1837 }, // big 06:00|07:00 sweep
  settle: { from: 1837, to: 2075 }, // A/B + CLS pill + central banks flows
  docsRow: { from: 2075, to: 2237 }, // instruction docs sliding row
  checks: { from: 2237, to: 2362 }, // doc pair + 3 red checkmarks
  pvp: { from: 2362, to: 2737 }, // handshake PvP flows
  target9: { from: 2737, to: 2837 }, // 09:00 settlement completion target
  brackets: { from: 2837, to: 3040 }, // Settlement / Funding bars + 8.0+
  payouts: { from: 3040, to: 3200 }, // chips over A..H
  summary: { from: 3200, to: 3394 }, // full summary diagram, pan-exit f3372..3393
  outro: { from: 3394, to: 3561 }, // world rotation: 0→90→0 (+gauge) → 180 + chips
  endCard: { from: 3561, to: 3750 }, // static logo card
} as const;

// ─── Copy (read off frames — exact) ───
export const COPY = {
  tagline: "trusted market solutions",
  pillars: ["Settlement", "Processing", "Data"],
  tradeExecuted: "Trade executed",
  priorToValueDate: "Prior to value date",
  milestones: {
    m0000: { time: "00:00", label: ["Initial pay-in schedule issued"] },
    m0630: { time: "06:30", label: ["Revised pay-in", "schedule issued"] },
    m0700: { time: "07:00", label: ["Start of settlement", "and funding"] },
    m0900: { time: "09:00", label: ["Settlement", "completion", "target time"] },
    m1200: { time: "12:00", label: ["Completion of", "pay-in / pay-out"] },
  },
  brackets: { settlement: "Settlement", funding: "Funding and pay-out" },
  trillion: { figure: "8.0", sup: "+", unit: "USD trillion" },
  summaryRows: [
    ["Payment instructions matched,", "confirmed and stored"],
    ["Net pay-ins"],
    ["Payment instructions settled"],
    ["Net pay-outs"],
  ],
  percents: ["0%", "96%", "99%"],
  members: ["A", "B", "C", "D", "E", "F", "G", "H"],
} as const;

// Currency carousel pairs (top code, bottom code, colors alternate
// red/navy). Read off regular_0011..0023.
export const CURRENCY_PAIRS: {
  top: string;
  bottom: string;
  topColor: "red" | "navy";
}[] = [
  { top: "USD", bottom: "JPY", topColor: "red" },
  { top: "DKK", bottom: "GBP", topColor: "navy" },
  { top: "AUD", bottom: "CHF", topColor: "red" },
  { top: "HKD", bottom: "NZD", topColor: "navy" },
  { top: "EUR", bottom: "GBP", topColor: "navy" },
];

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// ─── Content pack ───
// The replica and the CRX variant share every scene component; the pack
// carries all copy, names and brand hooks. CLS pack = the reference,
// crx-data.ts exports the CRX pack.
export type Pack = {
  tagline: string;
  pillars: readonly string[];
  tradeExecuted: string;
  priorToValueDate: string;
  milestones: {
    m0000: { time: string; label: readonly string[] };
    m0630: { time: string; label: readonly string[] };
    m0700: { time: string; label: readonly string[] };
    m0900: { time: string; label: readonly string[] };
    m1200: { time: string; label: readonly string[] };
  };
  brackets: { settlement: string; funding: string };
  trillion: { figure: string; sup: string; unit: string };
  summaryRows: readonly (readonly string[])[];
  percents: readonly string[];
  members: readonly string[];
  currencyPairs: { top: string; bottom: string; topColor: "red" | "navy" }[];
  // brand hooks
  serif: string;
  sans: string;
  brand: "cls" | "crx";
};

export const CLS_PACK: Pack = {
  ...COPY,
  milestones: COPY.milestones,
  currencyPairs: CURRENCY_PAIRS,
  serif: SERIF,
  sans: SANS,
  brand: "cls",
};
