# Anti-Cheat Flags — Twitter Targeting

Goal: find people who say their backtest was profitable but production wasn't.
Pitch them `https://generalmarket.io/anticheat-flags` — the page argues the gap
exists because venues structurally favor insiders.

## Spend

- 11 advanced_search probes
- ~3,300 credits = $0.033 total
- TwitterAPI.io endpoint: `/twitter/tweet/advanced_search` (`queryType=Latest`)
- Each probe returns up to 20 tweets, costs ~300 credits

## Query verdict (round 1 + 2)

| Tier | Query | Hit rate | Use |
|---|---|---|---|
| 1 | `"walk-forward" "fail" -filter:retweets lang:en` | ~17/20 | Highest signal. Quant vocab filters to the right crowd. |
| 1 | `"profitable in backtest" -filter:retweets lang:en` | 13/13 | Direct narrative match. |
| 1 | `"overfit" "live" -filter:retweets lang:en` | 17/20 | Quants and tool-builders. |
| 2 | `"paper trading" "real money" "lost" -filter:retweets lang:en` | ~8/20 | Half-on. Filter author bios. |
| 2 | `"backtest" "live" "doesn't work" -filter:retweets lang:en` | ~6/20 | Useful with stricter filter. |
| 2 | `"got sandwiched" "bot" -filter:retweets lang:en` | News cycle | Quote-tweet bait, not DM targets. |
| drop | `"slippage killed" -filter:retweets lang:en` | 2/20 | Single-trade complaints, not strategy death. |
| drop | `"hyperliquid" "frontrun" -filter:retweets lang:en` | 0/20 | Market chatter, not victims. |
| drop | `"my bot" "blew up" -filter:retweets lang:en` | 1/11 | Pulls gaming bots / AI agents. |
| drop | `"my algo" "blew" -filter:retweets lang:en` | 1/20 | "Algo" reads as social-media algorithm. |
| drop | `"my fills" "terrible" OR "different" -filter:retweets lang:en` | broken | OR clause polluted with non-trading. |

## High-confidence accounts found (sorted by signal × reach)

| Handle | Followers | Why |
|---|---|---|
| @DarwinexZero | 11,836 | "95% of backtested strategies fail when run live." Already the thesis. |
| @Your_NLP_Coach | 19,780 | "Perfect on paper often means OVER[fit]". Has run live and seen it. |
| @kieran__duff | 5,293 | In-sample vs OOS thread, exact narrative. |
| @kryll_io | (n/a) | "Profitable in backtest. Dead in 3 weeks." |
| @onlybreakouts | 6,167 | "kept seeing live strategies fail that had passed all three [validations]" |
| @haasonline | 2,894 | Bot-platform builder — could amplify the page |
| @SatwikPasunoori | (n/a) | "PF 1.1 in backtest → slippage/brokerage/spread destroys it live" |
| @frankgermain | (n/a) | "Was profitable in backtest, profitable in fwd test, put live, blew acc" |
| @oscar_flavioo | (n/a) | "74% sniper highly profitable in backtest and forward test and now live cant fill" |
| @0xQuaza | 237 | Two weeks finding edge before going live |
| @ClawArbs | 1,261 | Walk-forward out-of-sample on prediction-market bots |
| @anonymous9zs | 55 | Paper profitable 6mo → real money lost most |
| @cankeremgurel | 1,612 | Polymarket copy bot, paper good, lost on slippage |
| @Pradeep891730 | 63 | "From Backtest to Reality" deep dive |
| @m_schouten | 560 | "Walk-forward is where most 'edges' disappear" |
| @b162543 | 54 | Quant systematic — Sharpe → DSR → walk-forward layered validation |
| @SifuBacktest | 205 | Backtest-methodology builder |
| @pinevault | 38 | Over-optimization warning |
| @dddabtc | 223 | MNQ study null result with walk-forward |
| @RoyAmal | 197 | "Most trading bots fail before they even go live" |
| @THouseTraders | (n/a) | Engaged in a thread about not-profitable backtests |
| @Flower83_ | (n/a) | "enough that I am slightly profitable in backtest then, live, not so much" |
| @AlgoPatel | (n/a) | "brokerages, taxes and slippages" wipe most intraday systems |
| @BettysTrades | 402 | "Killer backtest → real money. One regime shift and it blows up." |
| @ventramtech | 65 | "backtests often overfit what holds up when this hits live" |
| @BruzWJ | 113 | Walk-forward concern with ML backtests |
| @jphilt1 | 138 | Called out a self-reported backtest |
| @MyraOlivara | 1,324 | "Backtests can still fail in live markets" |
| @riskmanaged_io | 15 | "Overfitting is the #1 strategy killer" |
| @bettersystrader | 13,797 | Perry Kaufman wrong-approach thread |

## Audit pass — 33 handles audited (2026-05-20)

Dispatched 3 parallel subagents over `audit.py`. Spent ~$0.35.

**Result of stock audit.py:** 32 FAIL, 1 CONDITIONAL (@kryll_io). The MM/HFT-tuned
gates suppress everyone — `bio_signal` and `follower_band ≥ 1000` are the killers.
Cache hygiene issue surfaced: `profiles.jsonl` line 237 had a concurrent-write
null-byte run that two agents independently repaired. Worth a structural fix
later — `_write_jsonl` lacks atomic rename.

## Re-rank with anti-cheat-narrative scorer (zero new API cost)

`anticheat_rerank.py` re-scores cached tweets against this audience's vocabulary
(backtest/walk-forward + live/production, overfit, slippage + strategy, MEV
sandwich + bot, alpha decay, paper trading + real money). Bio is a bonus, not a
gate. KOL flags subtract. Follower count is a log-scaled bonus, not a band.

**17 PRIME, 5 STRONG, 4 MAYBE, 7 WEAK.** Final outreach list at
`marketing/anticheat-flags-targets.tsv`. Technical pipeline (seeds, audit
JSONL, rerank scorer, reranked output) at `docs/x-targeting/anticheat_*`.
Highlights:

| Tier | Handle | Followers | Signal | The line |
|---|---|---|---|---|
| PRIME | @bettersystrader | 13.8k | 13 | Perry Kaufman: "parameter set with best backtest results is exactly the wrong approach" |
| PRIME | @kieran__duff | 5.3k | 10 | "In-sample backtests almost always exceed out-of-sample live results" |
| PRIME | @m_schouten | 560 | 12 | "Backtests don't fail in live. They just stop being protected by assumptions you didn't model." |
| PRIME | @onlybreakouts | 6.2k | 6 | "kept seeing live strategies fail that had passed all three [validations]" |
| PRIME | @DarwinexZero | 11.8k | 2 | "2.5%/mo backtest collapses to 0.8-1.2% live" — exact thesis |
| PRIME | @0xQuaza | 237 | 13 | "dry run went great. 72.7% WR, $1k → $1.96k in 4 days. Then I turned it live..." |

## Next moves

1. **Outreach.** PRIME handles are direct DM/reply targets. Cioran drafts at the
   bottom of this file. Send 5 at a time, log replies, iterate copy.
2. **Pagination if needed.** Top-3 queries (A/C/J) can still yield 80–100 more
   tweets per query with `next_cursor`. ~$0.03 each. Only spend if PRIME tier is
   exhausted.
3. **Cache hygiene.** Patch `cache.py::write_jsonl` to write to tempfile + rename.
   Concurrent agents are corrupting the shared store.
4. **Quote-tweet bait.** Strategy I (Vitalik-sandwiched news cycle) — different
   audience, different tone, same page. Use as second wave.

## Outreach drafts (Cioran voice, to refine)

For someone who said "profitable in backtest, dead in live":

> The backtest didn't lie. The venue did.
> [link]

For walk-forward sceptics:

> Walk-forward survives noise. It does not survive a venue that sees your order
> before you do.
> [link]

For the postmortem genre:

> Every strategy dies the same way. Most operators never learn what killed it.
> Eleven venues, the receipts.
> [link]
