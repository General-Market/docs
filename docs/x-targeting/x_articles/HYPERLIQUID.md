# Hyperliquid native X Article radar

Three surfaces, one engine (`find_native_x_articles.py`). A native X Article = a tweet whose payload carries a non-null `article` object — the long-form `x.com/i/article/...` format, not an external link.

## The three surfaces

| Surface | Niche slug | Window | Cap | What it answers |
|---|---|---|---:|---|
| Monthly top — ecosystem | `hyperliquid-30d` | 30 days | 100 | What won across all of Hyperliquid + ecosystem, by likes |
| Monthly deep — HIP-3 | `hip3-30d` | 30 days | 60 | Builder-deployed perps / HIP-3 / HIP-4 articles |
| Monthly deep — HyperEVM | `hyperevm-30d` | 30 days | 60 | HyperEVM + the apps building on it |
| Monthly deep — HL DeFi | `hl-defi-30d` | 30 days | 60 | HLP vaults, lending, LSTs (Felix, HypurrFi, HyperLend, Kinetiq…) |
| Daily | `hyperliquid` | 24 hours | 20 | What dropped today |

Each surface writes to `<date>/<niche>/`:
- `report.md` — ranked by author-average outlier lift (who broke their own ceiling).
- `by-likes.md` — ranked by raw likes (the headline ask).
- `articles.jsonl` — the full rows, both rankings derivable.

The UI server (`ui/server.mjs`) auto-discovers every `<date>/<niche>/articles.jsonl`, so all five appear in the niche dropdown with zero UI changes.

## Refresh

```bash
# Monthly (the 4 deep pages, 30-day lookback, by-likes generated per niche):
ROOT_DIR=/Users/maxguillabert/Downloads/index bash run_monthly.sh   # ~$1, ~15 min

# Daily (hyperliquid joins the existing niche list):
ROOT_DIR=/Users/maxguillabert/Downloads/index bash run_daily.sh     # cheap

# One page on its own:
python3 find_native_x_articles.py --niche hip3-30d --date $(date -u +%F) \
  --lookback-hours 720 --max-articles 60 --search-mode both --budget-usd 5
python3 rank_by_likes.py --niche hip3-30d --date $(date -u +%F) --top 60
```

## Why a niche-scoped likes ladder

The generic likes ladder pulls the platform's highest-`min_faves` native Articles, then filters locally — most get thrown away on a narrow niche. Each Hyperliquid niche sets a `likes_prefix` in `NICHE_CONFIG`, so the high-faves pull is spent *inside* the niche. The local classifier (`matches_niche`) is the safety net, not the primary filter.

Note: bare `hype` is excluded from the classifier (it collides with the English word); the token is matched as the cashtag `$hype`. See `term_in_text`.

## The honest ceiling

Native X *Articles* are a thin format. Over a 30-day window the whole ecosystem yields ~60 of them, not 100 — that is the real supply, not a search miss. The deep sub-topics are thinner still (HIP-3 ≈ 9). The cap is an upper bound; the report states what actually exists.
