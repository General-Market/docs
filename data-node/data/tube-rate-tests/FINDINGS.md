# Tube Rate-Limit Empirical Findings

Test run 2026-04-17 from a Mac residential IP (Paris). Seven tubes swept through a ramp of 0.5 → 1 → 2 → 5 → 10 req/sec, 15s per step, 249 harvested trending URLs, 1896 requests total.

## Headline

From a residential IP, **the rate limits are not the bottleneck. HTML parsing is.**

Six of seven tubes accepted the full ramp — including the 10 req/sec step — with zero 429s, zero 403s, and zero Cloudflare challenges. Pornhub scattered 12 stray 403s across the run (4.4%), none clustered. Eporner rate-limited at the 10 rps step with 22 clean 429s.

## Per-site results

| Site | Reqs | 200 | 429 | 403 | 5xx | CF-challenge | Net-err | Max sustained |
|------|-----:|----:|----:|----:|----:|-------------:|--------:|---------------|
| pornhub  | 275 | 263 | 0   | 12  | 0 | 0 | 0 | 10 rps (probabilistic 403s throughout) |
| xvideos  | 274 | 274 | 0   | 0   | 0 | 0 | 0 | 10 rps clean |
| xhamster | 276 | 276 | 0   | 0   | 0 | 0 | 0 | 10 rps clean |
| xnxx     | 268 | 268 | 0   | 0   | 0 | 0 | 0 | 10 rps clean |
| redtube  | 276 | 276 | 0   | 0   | 0 | 0 | 0 | 10 rps clean |
| youporn  | 276 | 276 | 0   | 0   | 0 | 0 | 0 | 10 rps clean |
| eporner  | 251 | 229 | 22  | 0   | 0 | 0 | 0 | 5 rps clean, 429s at 10 rps |
| **txxx** | — | — | — | — | — | — | — | **JS-rendered SPA, unscrapable without headless browser** |

## Where the failures landed

- **Pornhub's 12 × 403s** appeared scattered across req #50 through #275 — no sequential cluster. Cloudflare probabilistic challenge, not a hard block. No Retry-After header. IP was never fully banned. Characteristic of Cloudflare's Bot Management returning low-confidence blocks.
- **Eporner's 22 × 429s** all occurred at req #144–#245, precisely the 10 rps step. Upstream limiter, clean behavior. Respects `Retry-After`.

## Sustainable rate estimate (residential IP)

For a production data source polling every 2 minutes:

| Tube | Safe sustained rps | Videos per 2-min cycle at safe rate | Notes |
|------|-------------------:|------------------------------------:|-------|
| pornhub  | **2** | 240 | Cloudflare tolerates; stay under to avoid probabilistic blocks |
| xvideos  | 5 | 600 | No observed cap; gated by sanity, not API |
| xhamster | 5 | 600 | Same |
| xnxx     | 5 | 600 | Same |
| redtube  | 5 | 600 | Same |
| youporn  | 5 | 600 | Same |
| eporner  | **3** | 360 | 429 at 10 rps; 3 rps is safe |
| txxx     | — | 0 | JS-rendered, needs lustpress or a headless browser |

**Aggregate across 7 tubes at safe rates: ~30 rps, 3 600 videos per 2-min cycle.** Vastly more than the 50-per-tube default (350 total).

## VPS vs residential — expected divergence

My machine is a residential ISP IP. VPS 1 is a datacenter IP (Hetzner-ish AS). Datacenter IPs have materially worse reputation with Cloudflare. Expect:

- **Pornhub on VPS: probably 10x more 403s.** Cut safe rate to ~0.5 rps (30 req/min, 60 videos per 2-min cycle). Still enough.
- **Eporner on VPS: similar or worse.** 429 threshold likely lower.
- **Others on VPS: probably still fine.** The non-Cloudflare tubes (xvideos, xnxx, redtube, youporn) don't bother with bot scoring on simple GETs.

Run this test *from VPS 1* before tuning the source in production. That's the number that matters.

## Parsing reality check

Six of seven regexes in `test_tube_scrape.rs` failed to extract view counts from 200 responses:

| Site | View-count parsed | Format observed |
|------|-------------------|-----------------|
| xhamster | 276 / 276 (100%) | `"views":N` JSON int — clean |
| pornhub  | 0 / 263 | `<span class="count">962K` — K/M-formatted, needs post-processing |
| xvideos  | 0 / 274 | Views in a JS-rendered block, not present in raw HTML |
| xnxx     | 0 / 268 | Requires different regex |
| redtube  | 0 / 276 | Same |
| youporn  | 0 / 276 | Same |
| eporner  | 0 / 229 | Same |

**Implication:** writing per-site HTML parsers is the real engineering cost, not dodging rate limits. This is exactly what lustpress solves — it ships parsers for all eight tubes.

**Next step:** deploy lustpress on VPS 2, point the data-node `tubes` source at it, let lustpress handle parsing. Don't reinvent the eight regexes.

## How many videos can we track?

Realistic production budget, conservative:

- 7 scrapable tubes × 50 top videos per tube = **350 videos tracked**
- At 2-min sync interval, 350 videos / 120s = 2.9 rps aggregate
- Split across tubes: 0.4 rps per tube average — comfortably below every site's observed ceiling
- With lustpress's 90s cache, each video's upstream cost is capped at one request per 90 seconds regardless of data-node poll frequency

If you want to push harder: **1000+ videos** is reachable from a residential IP. From a VPS, stop at 350 until you prove the ceiling empirically.

## Artifacts

- `rate-test-{site}.csv` — per-request log (status, elapsed, CF-Ray, challenge flag, view-count, URL)
- `log-{site}.txt` — stdout from each ramp
- `run-all.log` — full sweep transcript
- `summary.tsv` — counts per site

## Commands to reproduce

```bash
cargo build --release --example test_tube_scrape
STEP_SECS=15 bash data-node/data/tube-rate-tests/run-all.sh
```

To retest a single site:
```bash
target/release/examples/test_tube_scrape \
    --site pornhub \
    --urls-file data-node/data/test-urls-pornhub.txt \
    --output data-node/data/tube-rate-tests/rate-test-pornhub.csv \
    --step-secs 30
```

## The takeaway

The tubes tolerate more than the folklore suggests. Cloudflare is less hostile to residential traffic than the scraping forums imply. The binding constraint is not request rate — it is per-site HTML parsing. Deploy lustpress, trust its parsers, keep your own request pressure below 1 rps per tube, and the feed will survive.

A rate limit is a polite refusal. A parsing failure is a silence. We found only silence.
