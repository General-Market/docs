import type { Shot } from "../types";

/**
 * Metronome cut — 2.5s per shot, 5s for finale + logo.
 * Adjust timings here when music lands. Nothing else changes.
 */
export const SHOTS: Shot[] = [
  {
    type: "broll-grid",
    startSec: 0,
    durationSec: 2.5,
    category: "twitch",
    question: "Will these streamers get\nmore viewers in 10 minutes?",
  },
  {
    type: "payoff-card",
    startSec: 2.5,
    durationSec: 2.5,
    statement: "Open 100,000 prediction\npositions with $1",
  },
  {
    type: "broll-grid",
    startSec: 5,
    durationSec: 2.5,
    category: "pumpfun",
    question: "Will this token pump\nin 5 minutes?",
  },
  {
    type: "payoff-card",
    startSec: 7.5,
    durationSec: 2.5,
    statement: "Join a vault making\nmillions of trades a day",
  },
  {
    type: "broll-grid",
    startSec: 10,
    durationSec: 2.5,
    category: "movies",
    question: "Will this movie\nhit #1 box office?",
  },
  {
    type: "payoff-card",
    startSec: 12.5,
    durationSec: 2.5,
    statement: "Experience liquidity for\nevery niche prediction market",
  },
  {
    type: "broll-grid",
    startSec: 15,
    durationSec: 2.5,
    category: "animals",
    question: "Will this species\nbe spotted today?",
  },
  {
    type: "payoff-card",
    startSec: 17.5,
    durationSec: 2.5,
    statement: "500,000 markets\n12,000 million settlements per day",
  },
  {
    type: "mega-grid",
    startSec: 20,
    durationSec: 5,
    category: "all",
    question: "And 500,000 more markets",
  },
  {
    type: "logo-reveal",
    startSec: 25,
    durationSec: 5,
    statement: "General Market\nTrade 10,000x more",
  },
];
