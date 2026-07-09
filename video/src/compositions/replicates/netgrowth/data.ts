// Reference copy + palette for the NetGrowth replica, measured off
// public/netgrowth-original.mp4 (CLSNet growth — netted value YoY,
// 1080×1080 @ 25fps, 709 frames = 3 cycles of one choreography).
// Every color is a median stroke sample; every string is read off frames.

export type RowData = {
  label: string; // stat row label, left of the track
  values: number[]; // displayed value per frame during the count, f50..f98
  legendLabel: string; // legend entry text
  bubble: string; // bubble + fill + legend-square color
  legendText: string; // legend text color (slightly muted vs bubble)
  digits: string; // value digits inside the bubble
};

export type NetGrowthCopy = {
  headlineSerif: string; // line 1, display serif
  headlineSans: string; // line 2, grotesque
  subtitle: string; // bold kicker under the headline
  rows: [RowData, RowData];
  footnote: string;
  logo: string; // serif lockup above the tagline
  taglineWords: [string, string, string]; // scale in one by one
};

// ─── Measured value tables (read frame-by-frame off the bubbles) ───
// Both rows ride ONE easing: values[f]/max is identical across rows.
// Rounded to 1 decimal exactly as displayed; ".0" is stripped on render.
export const VALUES_2026: number[] = [
  0, 0, 0.3, 1.1, 2.4, 4.2, 6.4, 9.1, 12.2, 15.6, 19.5, 23.7, 28.2, 32.9, 38,
  43.3, 48.8, 54.6, 60.5, 66.5, 72.7, 79, 85.4, 91.8, 98.3, 104.7, 111.2,
  117.6, 124, 130.3, 136.5, 142.5, 148.4, 154.2, 159.7, 165, 170.1, 174.8,
  179.3, 183.5, 187.4, 190.8, 193.9, 196.6, 198.8, 200.6, 201.9, 202.7, 203,
];
export const VALUES_2025: number[] = [
  0, 0, 0.2, 0.9, 2.1, 3.6, 5.6, 8, 10.7, 13.7, 17.1, 20.7, 24.7, 28.9, 33.3,
  38, 42.8, 47.8, 53, 58.3, 63.7, 69.3, 74.9, 80.5, 86.2, 91.8, 97.5, 103.1,
  108.7, 114.3, 119.7, 125, 130.2, 135.2, 140, 144.7, 149.1, 153.3, 157.3,
  160.9, 164.3, 167.3, 170, 172.4, 174.4, 175.9, 177.1, 177.8, 178,
];

// ─── Palette (median stroke samples at f180) ───
export const COLORS = {
  bg: "#142138",
  ink: "#FBFDFE", // headline / subtitle / logo / tagline
  label: "#DFE9EE",
  yellow: "#F6BA2F",
  teal: "#7CC5AD",
  legendYellow: "#EEBB3B",
  legendTeal: "#81C2B2",
  digits: "#02305A",
  track: "#354A62",
  footnote: "#C9D6E1",
  divider: "#F4FDFF",
};

export const NETGROWTH_COPY: NetGrowthCopy = {
  headlineSerif: "CLSNet growth",
  headlineSans: "netted value YoY",
  subtitle: "Average daily netted value*",
  rows: [
    {
      label: "2026 Q1 average daily:",
      values: VALUES_2026,
      legendLabel: "2026 USD billions",
      bubble: COLORS.yellow,
      legendText: COLORS.legendYellow,
      digits: COLORS.digits,
    },
    {
      label: "2025 Q1 average daily:",
      values: VALUES_2025,
      legendLabel: "2025 USD billions",
      bubble: COLORS.teal,
      legendText: COLORS.legendTeal,
      digits: COLORS.digits,
    },
  ],
  footnote:
    "*Netted value refers to bilateral net payment amounts calculated by CLSNet",
  logo: "CLSNet",
  taglineWords: ["Centralized.", "Standardized.", "Network."],
};

// Display format: one decimal, trailing ".0" stripped ("203", "19.5").
export const fmtValue = (v: number): string => {
  const s = v.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
};
