import { CATEGORIES, LAYOUT } from "../theme";

// Deterministic pseudo-random based on cell position.
export const hash = (r: number, c: number, seed: number): number => {
  const x = Math.sin(r * 12.9898 + c * 78.233 + seed * 43.758) * 43758.5453;
  return x - Math.floor(x);
};

// Linear interpolation between two hex colors.
export const mixColor = (a: string, b: string, t: number): string => {
  const ta = Math.max(0, Math.min(1, t));
  const parse = (hex: string): [number, number, number] => {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * ta);
  const g = Math.round(ag + (bg - ag) * ta);
  const bl = Math.round(ab + (bb - ab) * ta);
  return `rgb(${r}, ${g}, ${bl})`;
};

// Mix a color toward white (for brightness pulses).
export const brighten = (color: string, amount: number): string => {
  const t = Math.max(0, Math.min(1, amount));
  // Parse rgb(...) or #hex
  let r = 0,
    g = 0,
    b = 0;
  if (color.startsWith("rgb")) {
    const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) {
      r = parseInt(m[1]);
      g = parseInt(m[2]);
      b = parseInt(m[3]);
    }
  } else {
    const h = color.replace("#", "");
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  }
  const nr = Math.round(r + (255 - r) * t);
  const ng = Math.round(g + (255 - g) * t);
  const nb = Math.round(b + (255 - b) * t);
  return `rgb(${nr}, ${ng}, ${nb})`;
};

// Category partitions — kept identical across scenes so coloring is stable.
export const othersCategory = (c: number): number => {
  if (c <= 2) return 0;
  if (c <= 6) return 1;
  return 2;
};

export const gmCategory = (r: number, c: number): number => {
  const wave = r + c;
  const maxWave =
    LAYOUT.gridRowsExpanded + LAYOUT.gridColsExpanded - 2;
  const bucket = Math.floor((wave / maxWave) * CATEGORIES.length);
  return Math.min(CATEGORIES.length - 1, bucket);
};
