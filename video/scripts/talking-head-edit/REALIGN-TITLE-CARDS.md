# Title-card realignment — anchored to the real final.mp4 audio

**Problem (confirmed):** the 13 mechanism title cards fire *before* the line that
names them — 0.4s on the tight ones, **up to 4.9s on Feed Latency** (the "04:13"
complaint). Cause: overlay times were placed by eye against `final.mp4`, while the
only transcript on disk (`cuts.json`) is in *source* time and no longer matches the
baked cut (it reconstructs to 662.6s; the real file is 649.466s).

**Ground truth:** `final.mp4`'s own audio, transcribed with parakeet-mlx →
`/tmp/anticheat-final-transcript.json` (110 sentences, word-level, video clock).
Every illustration, subchart, and article already lands on the right words —
**only the title cards are wrong.** Each new time = the spoken cue minus a 0.3s lead.

## `overlays/chapters.ts` — CHAPTERS `at` values

| n | name | current | → new | Δ | spoken cue |
|---|------|--------:|------:|--:|-----------|
| 1 | Colocation | 27.459 | 27.30 | −0.16 | "Co-location." (already fine) |
| 2 | Unfair Fee Tiers | 71.394 | 71.78 | +0.39 | "…strategy that are very low edge" |
| 3 | Maxing Out Advantages | 112.726 | 112.98 | +0.25 | "Maxing out advantages." |
| 4 | Listing Front-Running | 146.696 | 147.26 | +0.56 | "Listing front running." |
| 5 | Dealer Flow Visibility | 178.172 | 178.54 | +0.37 | "Dealer flow visibility." |
| 6 | Order Flow | 224.471 | 225.78 | +1.31 | "Next is order flows." |
| 7 | Feed Latency | 252.401 | **257.30** | **+4.90** | "If you can see trades of others…" ← 04:13 |
| 8 | Matching & Queue Priority | 278.822 | 280.18 | +1.36 | "Unfair matching engine priority…" |
| 9 | Cancellation Priority | 317.317 | 318.98 | +1.66 | "…cancellation priorities." |
| 10 | API Rate Limits | 350.898 | 352.62 | +1.72 | "Unfair API rate limits." |
| 11 | Funding Rate Edge | 363.162 | 364.70 | +1.54 | "Unfair funding rate boundary…" |
| 12 | Market-Maker Rebates | 378.122 | **381.58** | **+3.46** | "MM programs that pays market making…" |
| 13 | Liquidation Engine Quirks | 431.35 | 433.42 | +2.07 | "Unfair liquidation engine quirks…" |

## `overlays/timeline.tsx` — 3 illustration nudges

These sit so close to their (now on-cue) title they'd leave it no read; m12 was
landing on the *funding* tail, not its own content.

| illustration | current `at` | → new | why |
|--------------|-------------:|------:|-----|
| `m07-feed-latency` | 257.923 | 258.70 | give the 257.30 title ~1.4s before it |
| `m10-api-rate-limits` | 352.627 | 354.00 | give the 352.62 title room; lands on API content |
| `m12-maker-rebates` | 379.978 | 383.00 | was on funding tail (374–380); move onto MM-rebate content (381.88+) |

## Optional follow-ups (NOT in this fix — judgment calls)

- `chapters.ts` `TURN_AT` 482.045 → ~469.8 — the rail resolves ~12s late; "But there
  is solutions" is spoken at 469.84.
- `timeline.tsx` `subchart("liquidation")` 463.0 → ~456 — currently on the wrap-up
  sentence, not the liquidation content.

Transcript artifact: `/tmp/anticheat-final-transcript.json` ·
readable: `/tmp/anticheat-final-readable.txt`
