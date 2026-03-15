# Vision Source Data Audit — 2026-03-13

Per-market historical data coverage across all 88 data-node sources.
**Criteria**: each market (asset) must have >= 1 day of price history in the last 30 days.

## Summary

| Status | Sources | Markets Affected |
|--------|---------|-----------------|
| NO_DATA | 16 | 1,843 registered, 0 prices |
| NO_HISTORY | 1 | 30 markets, all <1d span |
| MOSTLY_MISSING (>50% no 1d) | 5 | 5,401 missing / 10,155 with prices |
| PARTIAL (<50% missing) | 17 | 89,857 missing / 305,139 with prices |
| OK | 49 | 0 missing (all markets have 1d+) |

**Total**: 482,698 registered assets, 356,344 with price data, 258,716 with 1d+ history.

---

## NO_DATA — No price records at all (16 sources)

| Source | Registered Assets | Notes |
|--------|------------------|-------|
| cbp_border | 81 | Collector not running |
| cftc | 42 | Collector not running |
| ebird | 23 | Collector not running |
| finra | 25 | Collector not running |
| futures | 50 | Collector not running |
| github | 672 | Collector not running |
| imf | 60 | Collector not running |
| ioda | 50 | Collector not running |
| mta_subway | 24 | Collector not running |
| nrc_nuclear | 95 | Collector not running |
| opec | 1 | Collector not running |
| power_outages | 51 | Collector not running |
| reddit | 318 | Collector not running |
| ryanair | 40 | Collector not running |
| tfl_tube | 11 | Collector not running |
| worldbank | 300 | Collector not running |

## NO_HISTORY — Has prices but all <1 day span (1 source)

| Source | Registered | With Prices | Has 1d+ | No 1d | No Prices |
|--------|-----------|-------------|---------|-------|-----------|
| sec_13f | 45 | 30 | 0 | 30 | 15 |

## MOSTLY_MISSING — >50% of priced markets lack 1d history (5 sources)

| Source | Registered | With Prices | Has 1d+ | No 1d | No Prices | % Missing |
|--------|-----------|-------------|---------|-------|-----------|-----------|
| bls | 9 | 9 | 2 | 7 | 0 | 78% |
| mil_aircraft | 12,447 | 8,298 | 4,133 | 4,165 | 4,149 | 50% |
| pumpfun | 2,483 | 1,358 | 546 | 812 | 1,125 | 60% |
| sports | 1,803 | 480 | 69 | 411 | 1,323 | 86% |
| zillow | 10 | 10 | 4 | 6 | 0 | 60% |

## PARTIAL — Some markets missing 1d history (17 sources)

| Source | Registered | With Prices | Has 1d+ | No 1d | No Prices |
|--------|-----------|-------------|---------|-------|-----------|
| airnow | 332 | 332 | 331 | 1 | 0 |
| bestbuy | 70 | 63 | 61 | 2 | 7 |
| chaturbate | 19,516 | 16,973 | 10,564 | 6,409 | 2,543 |
| crates_io | 19,829 | 19,718 | 19,706 | 12 | 111 |
| crypto | 9,963 | 8,283 | 8,255 | 28 | 1,680 |
| defi | 6,607 | 6,581 | 6,561 | 20 | 26 |
| esports | 4,461 | 4,461 | 3,459 | 1,002 | 0 |
| hackernews | 7,510 | 7,510 | 5,846 | 1,664 | 0 |
| lastfm | 1,032 | 1,020 | 1,014 | 6 | 12 |
| mcbroken | 30 | 29 | 26 | 3 | 1 |
| ndbc | 214 | 211 | 209 | 2 | 3 |
| npm | 9,183 | 5,134 | 5,132 | 2 | 4,049 |
| nyc311 | 30 | 26 | 25 | 1 | 4 |
| polymarket | 116,222 | 58,638 | 41,684 | 16,954 | 57,584 |
| tmdb | 37,502 | 8,811 | 6,230 | 2,581 | 28,691 |
| twitch | 57,523 | 53,955 | 32,738 | 21,217 | 3,568 |
| usgs_water | 3,310 | 3,164 | 2,976 | 188 | 146 |
| weather | 161,125 | 149,665 | 108,853 | 40,812 | 11,460 |

Note: High-churn sources (twitch, polymarket, pumpfun, chaturbate, weather, mil_aircraft) naturally have many short-lived assets — streams end, markets resolve, tokens die, stations go offline. This is expected turnover.

## OK — All priced markets have 1d+ history (49 sources)

| Source | Registered | With Prices | Has 1d+ |
|--------|-----------|-------------|---------|
| adzuna | 8 | 8 | 8 |
| anilist | 2,001 | 2,001 | 2,001 |
| animals | 24 | 24 | 24 |
| backpacktf | 2,388 | 2,388 | 2,388 |
| bchain | 12 | 9 | 9 |
| bonds | 22 | 22 | 22 |
| citybikes | 30 | 17 | 17 |
| cloudflare | 193 | 193 | 193 |
| congress | 10 | 1 | 1 |
| courtlistener | 102 | 102 | 102 |
| crossref | 12 | 12 | 12 |
| db_trains | 58 | 58 | 58 |
| earthquake | 20 | 20 | 20 |
| ecb | 10 | 6 | 6 |
| eia | 9 | 9 | 9 |
| epidemic | 35 | 35 | 35 |
| faa_delays | 30 | 30 | 30 |
| finra_short_vol | 105 | 5 | 5 |
| flights | 25 | 25 | 25 |
| fourchan | 100 | 100 | 100 |
| gtfs_transit | 13 | 13 | 13 |
| iss | 5 | 3 | 3 |
| maritime | 25 | 25 | 25 |
| movebank | 986 | 196 | 196 |
| noaa_met | 118 | 83 | 83 |
| noaa_tides | 59 | 56 | 56 |
| nwps | 67 | 22 | 22 |
| openalex | 26 | 26 | 26 |
| parking | 24 | 20 | 20 |
| pubmed | 25 | 25 | 25 |
| pypi | 250 | 250 | 250 |
| queue_times | 30 | 30 | 30 |
| rates | 19 | 19 | 19 |
| sec_efts | 35 | 35 | 35 |
| sec_insider | 157 | 157 | 157 |
| shelter | 9 | 9 | 9 |
| spaceweather | 10 | 10 | 10 |
| stackexchange | 30 | 30 | 30 |
| steam | 502 | 502 | 502 |
| stocks | 778 | 757 | 757 |
| tomtom_evcharge | 25 | 10 | 10 |
| tomtom_traffic | 20 | 18 | 18 |
| twse | 1,078 | 1,078 | 1,078 |
| usa_spending | 12 | 12 | 12 |
| volcano | 50 | 50 | 50 |
| weather_alerts | 20 | 20 | 20 |
| wildfire | 20 | 20 | 20 |
| yahoo_drinks | 12 | 12 | 12 |
