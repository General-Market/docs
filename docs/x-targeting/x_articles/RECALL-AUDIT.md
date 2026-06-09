# Recall audit — why the radar missed native Articles

Done 2026-06-09 after the Hyperliquid pages looked thin. The finder has a funnel; a leak at any stage loses Articles before you ever see them — so no outlier can be found, because the Article was never in the set.

```
search returns tweets → tweet has a native `article` object → passes the niche filter → dedupe → ranked
```

## What was measured

Every API response is saved under each niche's `raw/`, so the funnel can be audited offline for free. Plus one live instrument, `audit_recall.py`: pull one broad platform-wide native-Article corpus, then for each niche compare what its **own keyword search** returns against the niche-relevant Articles sitting in the broad corpus. Articles relevant in the broad scan but absent from the niche search are the blind spot.

## Root causes found

| # | Leak | Effect | Fix |
|---|---|---|---|
| 1 | **CJK word boundary.** `\bhyperliquid\b` needs a word boundary, but a latin word flanked by Chinese/Japanese characters has none (both sides are letters). | Every CN/JP Article embedding a latin term (`株クラがHyperliquidを…`, `@HyperEVM_CN`) silently dropped. Large for crypto/AI. | `term_in_text` now uses ASCII boundaries `(?<![a-z0-9])…(?![a-z0-9])`. Helps **every** niche. |
| 2 | **Narrow term lists.** HIP-4 absent; bare `HYPE` excluded to dodge the English word. | Real `HIP-4`, `HYPE ETF`, `HYPE Tokenomics` Articles dropped. | Added HIP-4; `token_patterns` match bare HYPE only beside a token signal. |
| 3 | **No author signal.** A research-report title under `@HyperEVM_CN` reads as language-ambiguous. | In-niche creators invisible when their title doesn't name the niche. | Per-niche `author_regex`. |
| 4 | **Junk high-`min_faves` rungs.** For a narrow niche, `min_faves:1000 url:x.com/i/article` returns platform-wide top Articles (verified 0 Hyperliquid-relevant at ≥1000), because few niche Articles clear that bar. | Pagination depth burned on junk; real niche Articles never reached. | Narrow niches drop the high rungs and spend the budget on deeper keyword pages. |
| 5 | **`max-articles` truncation.** The ladder stops the moment it holds `max` Articles (`find_native_x_articles.py:753`); daily default was 20. | High-population niches (`ai`, `polymarket`, `pumpfun`, `trading`) were silently capped at 20/day — the tail, and its outliers, never seen. | Per-niche cap: broad niches → 50 + 8 pages; narrow → 40 + 5. |

## Per-niche verdict (48h broad corpus = 108 Articles)

| niche | found by niche search | relevant in broad scan | missed by search | diagnosis |
|---|---:|---:|---:|---|
| `ai` | 25 | 32 | **27** | big gap — huge population, capped/under-paginated |
| `polymarket` | 51 | 2 | 1 | truncated at 20 by the cap |
| `pumpfun` | 48 | 1 | 0 | truncated at 20 by the cap |
| `trading` | 37 | 9 | 7 | truncated + minor |
| `crypto` | 30 | 9 | 5 | minor |
| `prediction-markets` | 25 | 2 | 1 | fine |
| `trading-ai` | 15 | 3 | 2 | fine — few exist, match_all is correct |

The lesson is that the leak is **not uniform**. Specific niches (`trading-ai`, `prediction-markets`) already capture nearly everything; the broad, high-volume niches were starved by the cap and by shallow pagination. The keyword lists were rarely the problem for the broad niches — the AI misses already pass the `ai` filter. The cap was.

## Result

`hyperliquid-30d`: 59 → **94** native Articles after fixes 1–4. The daily broad niches are uncapped from 20 → 50 (fix 5).

## Re-run

```bash
# Re-pull one niche deep:
python3 find_native_x_articles.py --niche ai --date $(date -u +%F) \
  --lookback-hours 24 --pages 8 --search-mode both --max-articles 50 --budget-usd 5
# Re-audit recall across the daily niches:
python3 audit_recall.py --niches ai trading crypto polymarket pumpfun --lookback-hours 48
```
