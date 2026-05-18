export const W = 1920;
export const H = 1080;
export const FPS = 30;

export const C = {
  bg: "#000000",
  ink: "#E6E6E6",
  inkDim: "#A0A0A0",
  inkFaint: "#5E5E5E",
  inkMuted: "#7C7C7C",
  grid: "#1A1A1A",
  gridFaint: "#0E0E0E",
  white: "#FFFFFF",
  blue: "#5B9BD5",
  blueDeep: "#3F7FBB",
  blueLight: "#9CC1DD",
  blueCool: "#7090C8",
  red: "#D85050",
  redDeep: "#B83838",
  redPale: "#F0B0A0",
  cream: "#F4E0D2",
  positive: "#5B9BD5",
  negative: "#D85050",
};

export const FONT_DISPLAY =
  '"SF Pro Display", Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';
export const FONT_TEXT =
  '"SF Pro Text", Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';
export const FONT_MONO =
  '"SF Mono", "JetBrains Mono", "Menlo", Consolas, monospace';

export const DIVERGING_BLUE_RED = [
  { stop: -0.4, color: "#D85050" },
  { stop: -0.3, color: "#E08070" },
  { stop: -0.2, color: "#EEB0A0" },
  { stop: -0.1, color: "#F4D8CE" },
  { stop: 0.0, color: "#F5F5F5" },
  { stop: 0.1, color: "#D0E1F0" },
  { stop: 0.15, color: "#9CC1DD" },
  { stop: 0.18, color: "#6BA0CC" },
  { stop: 0.2, color: "#3F7FBB" },
];

export const SEQUENTIAL_RED = [
  "#FFE5DC",
  "#FBC9B9",
  "#F5A98F",
  "#EC8265",
  "#DD5641",
  "#C42E25",
  "#9B1717",
];

export const SEQUENTIAL_BLUE = [
  "#E1ECF7",
  "#BBD3EC",
  "#92B8DE",
  "#6B9DCF",
  "#4A82BE",
  "#2F66AC",
  "#1F4F92",
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export function divergingColor(
  value: number,
  min = -0.4,
  max = 0.2,
): string {
  const stops = DIVERGING_BLUE_RED;
  const v = Math.max(min, Math.min(max, value));
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (v >= a.stop && v <= b.stop) {
      const t = (v - a.stop) / (b.stop - a.stop || 1);
      return lerpColor(a.color, b.color, t);
    }
  }
  return v < min ? stops[0].color : stops[stops.length - 1].color;
}

export function sequentialColor(value: number, ramp = SEQUENTIAL_RED): string {
  const v = Math.max(0, Math.min(1, value));
  const scaled = v * (ramp.length - 1);
  const i = Math.floor(scaled);
  const t = scaled - i;
  if (i >= ramp.length - 1) return ramp[ramp.length - 1];
  return lerpColor(ramp[i], ramp[i + 1], t);
}

export function blueRedRamp(t: number): string {
  // 0 = blue, 0.5 = white, 1 = red
  const v = Math.max(0, Math.min(1, t));
  if (v < 0.5) return lerpColor("#3F7FBB", "#F5F5F5", v * 2);
  return lerpColor("#F5F5F5", "#D85050", (v - 0.5) * 2);
}

// Seeded RNG for deterministic synthetic data.
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rng: () => number, mu = 0, sigma = 1): number {
  // Box-Muller
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
