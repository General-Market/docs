---
title: The market catalog
navTitle: Markets
description: 47 data sources in 16 categories, from DeFi to weather, with the tick cadence of each.
order: 4
group: Gameplay
mode: reference
---

```gmplain
Vision runs on real-world data feeds called sources — Twitch viewers, earthquakes, interest rates, theme-park queues. Each source ticks on its own clock, from once a minute to once a week, and every tick is one prediction round. This page lists the whole catalog: what each source measures and how often it resolves.
```

```gmsummary
How to read this catalog :: One source = one feed; its tick is its round length
The full catalog :: All 47 sources in 16 categories, with cadence
Fastest and slowest sources :: The file says Twitch every minute; live ticks differ
Where the live list comes from :: The app reads GET /vision/sources, not this file
```

## How to read this catalog

A **source** is one real-world data feed. Inside it, each **market** is one measured thing — one streamer's viewer count, one protocol's TVL. A source's **tick** is its heartbeat: every tick, the open block on that source resolves and a new one is created. A source that ticks every 2 minutes gives you a result every 2 minutes; a source that ticks daily makes you wait a day.

The catalog below comes from the repository's `markets.json`: **47 sources across 16 categories**, counted from the file itself.

## The full catalog

| Category | Source | Ticks | What it measures |
|---|---|---|---|
| Finance | `defi` | every 2 minutes | DeFi protocol metrics — TVL, yields, volumes |
| Finance | `rates` | every day | Interest rates — Fed funds, SOFR, Treasury yields |
| Finance | `bonds` | every day | Bond markets — yields, spreads, credit indices |
| Finance | `pumpfun` | every 5 minutes | Pump.fun — Solana memecoin launches, volumes, graduations |
| Finance | `polymarket` | every 5 minutes | Polymarket — prediction market probabilities |
| Economic | `worldbank` | every 7 days | World Bank indicators — GDP, trade, development |
| Economic | `eia` | every day | Energy Information Admin — oil, gas, electricity prices |
| Economic | `ecb` | every day | European Central Bank — EUR rates, money supply |
| Economic | `usa_spending` | every hour | Federal spending — contract awards, grant disbursements |
| Economic | `adzuna` | every 30 minutes | Job market — listing counts, salary trends by category |
| Regulatory | `sec_13f` | every 6 hours | SEC 13F filings — institutional holdings changes |
| Regulatory | `finra_short_vol` | every day | FINRA short volume — daily short interest ratios |
| Regulatory | `congress` | every day | Congressional trading — disclosed stock transactions |
| Blockchain | `bchain` | every day | Blockchain metrics — hashrate, difficulty, fees, mempool |
| Blockchain | `bls` | every day | Bureau of Labor Statistics — employment, CPI, wages |
| Weather & Environment | `weather` | every hour | Live weather — temperature, wind, pressure across cities |
| Weather & Environment | `weather_alerts` | every 5 minutes | NWS weather alerts — severe storms, warnings, watches |
| Weather & Environment | `airnow` | every 10 minutes | Air quality — AQI readings, PM2.5, ozone by region |
| Weather & Environment | `noaa_tides` | every 15 minutes | NOAA tides — water levels, tide predictions, station data |
| Weather & Environment | `noaa_met` | every 10 minutes | NOAA meteorological — station readings, pressure, humidity |
| Weather & Environment | `ndbc` | every 10 minutes | NDBC buoys — wave height, ocean temperature, wind at sea |
| Weather & Environment | `nwps` | every 10 minutes | Nuclear power — reactor status, output, capacity factors |
| Weather & Environment | `usgs_water` | every 10 minutes | USGS water — river flow rates, gauge heights, flood levels |
| Weather & Environment | `wildfire` | every 30 minutes | Active wildfires — fire count, acres burned, containment |
| Weather & Environment | `earthquake` | every 5 minutes | USGS earthquakes — magnitude, frequency, locations |
| Space | `spaceweather` | every 10 minutes | Space weather — solar wind, Kp index, CME alerts |
| Space | `iss` | every 10 minutes | ISS tracking — orbital position, crew activity, experiments |
| Entertainment | `twitch` | every minute | Twitch — live viewer counts, channel rankings |
| Entertainment | `steam` | every 10 minutes | Steam — concurrent players, game rankings |
| Entertainment | `anilist` | every 10 minutes | Anime popularity — trending shows, scores, watch counts |
| Entertainment | `fourchan` | every 10 minutes | 4chan board activity — post rates, unique posters |
| Entertainment | `chaturbate` | every 10 minutes | Chaturbate — room viewer counts, performer rankings |
| Entertainment | `queue_times` | every 10 minutes | Theme parks — ride wait times, park capacity |
| Tech & Internet | `hackernews` | every 5 minutes | Hacker News — top story scores, comment velocity |
| Tech & Internet | `cloudflare` | every 10 minutes | Cloudflare Radar — internet traffic, attack trends |
| Gaming | `backpacktf` | every 10 minutes | TF2 item market — unusual hat prices, trade volumes |
| Real Estate | `zillow` | every day | Zillow — home values, rent indices by metro |
| Transport | `gtfs_transit` | every 2 minutes | Public transit — real-time delays, ridership, on-time % |
| Transport | `mta_subway` | every 5 minutes | NYC subway — train delays, service alerts, ridership |
| Transport | `citybikes` | every 10 minutes | City bike sharing — available bikes, station occupancy |
| Transport | `parking` | every 10 minutes | Parking — garage occupancy, available spaces, pricing |
| Nature | `animals` | every 10 minutes | Animal tracking — migration patterns, species sightings |
| Military | `mil_aircraft` | every 10 minutes | Military aircraft — tracked flights, ADSB activity |
| Sports | `sports` | every 10 minutes | Live sports — scores, standings, game states |
| Academic | `crossref` | every 10 minutes | Academic papers — citation counts, publication rates |
| Academic | `pubmed` | every 10 minutes | PubMed — biomedical publication trends, MeSH topics |
| Retail | `bestbuy` | every 10 minutes | Best Buy — product pricing, deal counts, rating changes |

```gmnote
The catalog file also assigns each source a numeric batchId (0–46) — "batch" is the contract's word for a block. That is a static catalog index, not a live block number: live blocks mint a fresh, ever-increasing id every round. Never join by catalog id.
```

## Fastest and slowest sources

- In the catalog file: `twitch` is fastest (every minute), `worldbank` slowest (every 7 days).
- On the live system (checked 2026-06-10): the fastest cadence is **5 minutes**, `twitch` ticks every **10 minutes**, and `worldbank` still ticks weekly. The live cadence per source comes from the config the oracle fetches at block creation, not from this file.
- The contract clamps every source's tick to between 60 seconds and 7 days (604,800 s); both the catalog and the live configs stay inside that range.

A faster tick means faster feedback and more rounds per day; a slower tick means each prediction carries longer. Pick by temperament. For a first run: [Place your first predictions](/docs/vision/first-predictions) (~15 min).

## Where the live list comes from

The app does not read this file. It reads `GET /vision/sources` from the data node, and the home page and explorer render what that returns — so the set of sources you see in the app is the live truth and can differ from this catalog.

**This catalog is a snapshot — `markets.json` is dated 2026-03-31.** Sources get added, curated views get split out, cadences get retuned, and dead feeds get delisted without this file changing. A live check on 2026-06-10 found **84 sources with open rounds** — nearly twice this file's 47 — including curated DeFi views (`defillama-*`) and sources the file predates (`binance_spot`, `lichess`, `tmdb`). For the live, machine-readable list, use the discovery endpoints: [Sources, snapshots, and search](/docs/developers/vision-api/discovery) (~3 min).

```gmseealso
[{"title": "Place your first predictions", "href": "/docs/vision/first-predictions"}, {"title": "Blocks, ticks, and rounds", "href": "/docs/vision/blocks-and-ticks"}, {"title": "Sources, snapshots, and search", "href": "/docs/developers/vision-api/discovery"}]
```

Next: [How predictions are sealed](/docs/vision/predictions-and-bitmaps) (~4 min)
