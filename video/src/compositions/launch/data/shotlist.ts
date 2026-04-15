import type { Shot } from "../types";

/**
 * Broken metronome — hard cuts on the clock, but the pattern never repeats.
 * Grid, card, grid-with-statement, rapid double grid, long card hold,
 * quad split, stats, mega, logo. Adjust timings when music lands.
 */
export const SHOTS: Shot[] = [
  // ── Opening hook: classic grid → card
  {
    type: "broll-grid",
    startSec: 0,
    durationSec: 2.5,
    category: "twitch",
    question: "Will these streamers get\nmore viewers in 10 minutes?",
    words: ["Will", "these streamers", "get more viewers", "in 10", "minutes?"],
  },
  {
    type: "payoff-card",
    startSec: 2.5,
    durationSec: 2.5,
    statement: "Open 100,000 prediction\npositions with $1",
  },

  // ── No card break — payoff lives ON the grid
  {
    type: "broll-grid-statement",
    startSec: 5,
    durationSec: 3,
    category: "pumpfun",
    question: "Will this token pump\nin 5 minutes?",
    words: ["Will", "this token", "pump", "in 5", "minutes?"],
    statement: "Join a vault making\nmillions of trades a day",
  },

  // ── Rapid double grid — two categories, no breathing room
  {
    type: "broll-grid",
    startSec: 8,
    durationSec: 1.5,
    category: "movies",
    question: "Will this movie\nhit #1 box office?",
    words: ["Will this movie", "hit #1", "box office?"],
  },
  {
    type: "broll-grid",
    startSec: 9.5,
    durationSec: 1.5,
    category: "animals",
    question: "Will this species\nbe spotted today?",
    words: ["Will this species", "be spotted", "today?"],
  },

  // ── Earned hold — longer card after the rapid fire
  {
    type: "payoff-card",
    startSec: 11,
    durationSec: 3,
    statement: "Experience liquidity for\nevery niche prediction market",
  },

  // ── Finale
  {
    type: "mega-grid",
    startSec: 14,
    durationSec: 6,
    category: "all",
    question: "And 500,000 more markets\n12,000 million settlements per day",
  },
  {
    type: "logo-reveal",
    startSec: 20,
    durationSec: 5,
    statement: "General Market\nTrade 10,000x more",
  },
];
