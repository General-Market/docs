import type { BrollCategory } from "./types";

/**
 * How many b-roll files are available per category.
 * Set to 0 to show colored placeholders.
 * Update as downloads complete.
 */
export const BROLL_COUNTS: Record<string, number> = {
  twitch: 0,
  pumpfun: 0,
  movies: 0,
  animals: 0,
};

export const PLACEHOLDER_COLORS: Record<string, string[]> = {
  twitch: [
    "#9146FF", "#6441A5", "#B9A3E3", "#7B2FBE",
    "#A970FF", "#772CE8", "#BF94FF", "#5C16C5",
  ],
  pumpfun: [
    "#00D4AA", "#10B981", "#34D399", "#059669",
    "#6EE7B7", "#047857", "#A7F3D0", "#065F46",
  ],
  movies: [
    "#F59E0B", "#D97706", "#FBBF24", "#B45309",
    "#FCD34D", "#92400E", "#FDE68A", "#78350F",
  ],
  animals: [
    "#22C55E", "#16A34A", "#4ADE80", "#15803D",
    "#86EFAC", "#166534", "#BBF7D0", "#14532D",
  ],
};

export function brollPath(category: string, index: number): string {
  const padded = String(index + 1).padStart(2, "0");
  const ext = category === "movies" ? "jpg" : "mp4";
  return `launch/broll/${category}/${category}-${padded}.${ext}`;
}

export function hasBroll(category: string, index: number): boolean {
  return index < (BROLL_COUNTS[category] ?? 0);
}
