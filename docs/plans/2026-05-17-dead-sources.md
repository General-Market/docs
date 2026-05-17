# Vision source triage — 2026-05-17

User reported 17 source slugs in `fund-branding.json` with vaults but
"zero batches on chain." The phrasing was inaccurate. The taxonomy
sorts cleaner than the report.

## Diagnosis

The user's exemplar was the DefiLlama vault
`0xFeA8f6bb8bec5e7401b96b218E489DD56934AFC6` ("Unlock") stuck at
NAV=$1.0000. Tracing the fund-manager:

- `funds.toml` says `sources = ["defillama"]`.
- `vision_batch_lifecycle` tags the same batches `defi`.
- `source-aliases.json` already declared `defillama -> [defi]`.
- `build_source_id_map` hashed both keccak variants — but
  `fund_manager.py` only consulted that map for **0x-prefixed**
  source IDs. The batches API returns plain strings now.
- `FundState.matches_source` therefore tested `"defi" in {"defillama"}`,
  which is False. The fund joined nothing.

Three orphans confirmed: `defillama`, `nasdaq`, `sec`. Add
`coingecko` and `pandascore` aliases too — they would have hit the
same wall the moment any fund pointed at them.

## Bucket A — alias / rename

Fixed in code. `FundState.__init__` now expands `self.sources` into
`self.match_set` via the alias registry; `matches_source` consults
the expanded set.

| canonical (funds.toml + fund-branding) | data-node tag |
|---|---|
| defillama | defi |
| nasdaq | stocks |
| sec | sec_13f, sec_efts, sec_insider |
| treasury | bonds |
| fred | rates |
| gtfs_rt | gtfs_transit |
| coingecko | crypto |
| pandascore | esports |

Identity sources (alias not needed, batches are daily/weekly so
"1 in 24h" is the healthy rate, not the broken one):

- bchain, bls, boe, congress, ecb, eia, finra_short_vol, github,
  worldbank, zillow

## Bucket B — frontend hide

Source has a fetcher but the data-node disables it (`DISABLED_SOURCES`
in `batch_engine.rs`). Legacy batches still resolve over deep link;
listing the source as "live" in the UI is a lie. Added to
`frontend/lib/vision/hidden-sources.ts`:

- bestbuy — free API tier rate-limits every call
- flights — provider 503 on every coordinate

(`weather` was already hidden.)

Vault USDC stays recoverable; the sidebar stops advertising.

## Bucket C — orphan

- `finra` — fetcher exists; OAuth creds (`FINRA_CLIENT_ID` /
  `FINRA_CLIENT_SECRET`) are blank in `data-node/.env`. No rows in
  `market_prices_latest`. Already in the hide list.

## Verification

Restart fund-manager on VPS 1, wait one cycle, expect:

- `[Unlock]`, `[Yield]`, `[Lockflow]` log lines transition from
  `batches=0` to `batches=1+`.
- `Cycle N: joined, source_match=True`.
- Per-vault NAV starts drifting from `1.00000` as defi batches settle.

`nasdaq`-tagged funds (none in current funds.toml — verified by grep)
will pick up `stocks` batches the next deploy that adds them.
