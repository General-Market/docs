export type ShotType = "broll-grid" | "payoff-card" | "mega-grid" | "logo-reveal";

export interface Shot {
  type: ShotType;
  startSec: number;
  durationSec: number;
  /** For broll-grid: the question overlaid on the blur */
  question?: string;
  /** For payoff-card: the statement on blank screen */
  statement?: string;
  /** For broll-grid: which category of footage */
  category?: "twitch" | "pumpfun" | "movies" | "animals" | "all";
}
