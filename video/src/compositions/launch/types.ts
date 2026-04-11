export type ShotType =
  | "broll-grid"
  | "broll-grid-statement"
  | "quad-grid"
  | "payoff-card"
  | "mega-grid"
  | "logo-reveal";

export type BrollCategory = "twitch" | "pumpfun" | "movies" | "animals" | "all";

export interface Shot {
  type: ShotType;
  startSec: number;
  durationSec: number;
  question?: string;
  statement?: string;
  category?: BrollCategory;
  /** For quad-grid: which four categories to show */
  categories?: BrollCategory[];
  /** Word groups revealed one at a time, grid expands with each */
  words?: string[];
}
