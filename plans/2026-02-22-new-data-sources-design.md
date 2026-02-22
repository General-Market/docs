# Design: 10 New "Bet on Everything" Data Sources

**Date:** 2026-02-22
**Status:** Approved

## Context

The Index data-node currently has 32 market data sources covering crypto, stocks, weather, politics, gaming, social, dev ecosystems, and entertainment. To expand the "bet on everything" vision, we add 10 genuinely new sources with zero overlap to existing ones. All are free APIs requiring no API key (or free registration only), pollable every 5-30 minutes.

## New Sources

### 1. USGS Volcanoes (`volcano`)
- **API:** `https://volcanoes.usgs.gov/vsc/api/volcanoApi/`
  - `/elevated` — volcanoes with above-normal alert levels
  - `/volcanoesGVP` — full worldwide catalog (Smithsonian GVP)
- **Auth:** None
- **Poll:** 10 min
- **Assets:** ~170 US + worldwide volcanoes with elevated status
- **Metrics:** Alert level (Normal/Advisory/Watch/Warning), color code (Green/Yellow/Orange/Red), eruption status
- **source_id:** `volcano`
- **Config JSON assets:** Top 50 most-monitored volcanoes (Kilauea, Etna, Fuji, Vesuvius, etc.)
- **Bet ideas:** Alert level transitions, active eruption count, regional volcanic activity index

### 2. USGS Earthquakes (`earthquake`)
- **API:** `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/`
  - `all_hour.geojson` — all earthquakes in last hour
  - `significant_month.geojson` — significant earthquakes this month
  - `4.5_day.geojson` — M4.5+ in last day
- **Auth:** None
- **Poll:** 5 min (feeds update every minute)
- **Assets:** ~10 aggregate metrics (hourly count by magnitude band, largest in 24h, by region)
- **Metrics:** Earthquake count per magnitude range (M2.5+, M4.5+, M5+), max magnitude in period, event count by tectonic region
- **source_id:** `earthquake`
- **Config JSON assets:** Predefined magnitude bands + top seismic regions (Ring of Fire, Mediterranean, Mid-Atlantic Ridge, etc.)
- **Bet ideas:** "M5.0+ earthquake in next 24h?", daily earthquake count above/below threshold

### 3. NOAA Space Weather (`spaceweather`)
- **API:** `https://services.swpc.noaa.gov/products/`
  - `noaa-planetary-k-index.json` — Kp geomagnetic index
  - `solar-wind/plasma-7-day.json` — solar wind speed/density
  - `solar-flare-report.json` — solar flare events
  - `noaa-scales.json` — G/S/R scale alerts
- **Auth:** None
- **Poll:** 10 min
- **Assets:** ~10 metrics (Kp index, solar wind speed, proton flux, X-ray flux, sunspot number, solar flare class)
- **Metrics:** Kp index (0-9 geomagnetic scale), solar wind speed (km/s), flare class (A/B/C/M/X with magnitude), proton event level
- **source_id:** `spaceweather`
- **Config JSON assets:** Static list of 10 space weather metrics
- **Bet ideas:** "Kp ≥5 (geomagnetic storm) today?", "X-class solar flare this week?", "Solar wind >600 km/s?"

### 4. NASA FIRMS Wildfires (`wildfire`)
- **API:** `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/VIIRS_SNPP_NRT/{region}/1`
- **Auth:** Free MAP_KEY (register at firms.modaps.eosdis.nasa.gov)
- **Poll:** 30 min (satellite revisit every 3-4 hours, but API aggregates)
- **Assets:** ~20 regions (US-West, US-East, Amazon, Australia, Siberia, Central Africa, Southeast Asia, Mediterranean, etc.)
- **Metrics:** Active fire hotspot count per region, total fire radiative power (FRP, MW), global fire pixel count
- **source_id:** `wildfire`
- **Config JSON assets:** 20 predefined geographic bounding boxes for major fire-prone regions
- **Bet ideas:** "California hotspots >500?", "Global fire count >10,000?", "Amazon fires increasing week-over-week?"

### 5. OpenSky Flight Tracking (`flights`)
- **API:** `https://opensky-network.org/api/states/all`
  - Query params: `lamin, lamax, lomin, lomax` for bounding box
- **Auth:** None (anonymous), free registration for higher limits
- **Rate limit:** Anonymous: 10 sec cooldown (~360 req/hr). Registered: 5 sec cooldown
- **Poll:** 10 min
- **Assets:** ~30 major regions/airports (US airspace, Europe, Asia-Pacific, specific airports: JFK, Heathrow, Dubai, etc.)
- **Metrics:** Airborne aircraft count per region, total tracked globally, flights by origin country
- **source_id:** `flights`
- **Config JSON assets:** 30 bounding boxes for major air traffic regions/airports
- **Bet ideas:** "European airspace >5000 flights at noon?", "Total tracked aircraft >12,000?"

### 6. AIS Maritime Vessels (`maritime`)
- **API:** `https://aisstream.io/` (REST API + WebSocket)
  - REST: vessel positions by bounding box
  - WebSocket: real-time stream `wss://stream.aisstream.io/v0/stream`
- **Auth:** Free API key (registration)
- **Poll:** 10 min (REST snapshots; optionally buffer from WebSocket)
- **Assets:** ~30 major ports and shipping lanes (Singapore, Rotterdam, Shanghai, Suez Canal, Panama Canal, LA/Long Beach, etc.)
- **Metrics:** Vessel count per port/region, vessels at anchor (congestion indicator), tanker count, average vessel speed
- **source_id:** `maritime`
- **Config JSON assets:** 30 port/lane bounding boxes with names
- **Bet ideas:** "Ships at anchor in Singapore >200?", "Suez Canal daily traffic >50?", "Port congestion index rising?"

### 7. disease.sh Epidemics (`epidemic`)
- **API:** `https://disease.sh/v3/covid-19/`
  - `/all` — global totals
  - `/countries` — per-country data
  - Also: `/v3/influenza/` endpoints
- **Auth:** None
- **Poll:** 30 min (data updates every few hours)
- **Assets:** ~30 most-tracked countries + global aggregate + flu metrics
- **Metrics:** Daily new cases, deaths, recoveries, active cases, cases per million, test positivity rate
- **source_id:** `epidemic`
- **Config JSON assets:** Top 30 countries by population + global + flu subtypes
- **Bet ideas:** "Global daily cases >X?", "Country Y weekly change >10%?", "Flu season peak week?"

### 8. ESPN Live Scores (`sports`)
- **API:** `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard`
  - Sports: basketball/nba, football/nfl, baseball/mlb, hockey/nhl, soccer/eng.1 (Premier League)
- **Auth:** None (undocumented public API, widely used)
- **Poll:** 1 min during live games, 10 min otherwise
- **Assets:** ~100 teams across 5 leagues (NBA 30, NFL 32, MLB 30, NHL 32, EPL 20)
- **Metrics:** Live score, game status, win/loss record, points scored per game, team standings
- **source_id:** `sports`
- **Config JSON assets:** Team list per league with ESPN IDs
- **Bet ideas:** "Lakers score >110?", "Total Premier League goals this matchday >25?", "NFL team X wins?"

### 9. ISS Position (`iss`)
- **API:** `http://api.open-notify.org/iss-now.json`
  - Also: `http://api.open-notify.org/astros.json` — people in space
- **Auth:** None
- **Poll:** 10 min
- **Assets:** ~5 derived metrics (latitude band, continent overhead, altitude, people in space)
- **Metrics:** Current latitude/longitude, altitude (km), velocity (km/h), continent name (derived from coords), people in space count
- **source_id:** `iss`
- **Config JSON assets:** Static asset list: iss_latitude, iss_longitude, iss_altitude, iss_continent, people_in_space
- **Bet ideas:** "ISS over Pacific at noon UTC?", "People in space >10?", "ISS latitude >60°N?"

### 10. NWS Severe Weather Alerts (`weather_alerts`)
- **API:** `https://api.weather.gov/alerts/active`
  - Query params: `?status=actual&message_type=alert`
  - Filter by: `area` (state), `event` (Tornado Warning, Hurricane Warning, etc.)
- **Auth:** User-Agent header only (no key)
- **Poll:** 5 min
- **Assets:** ~15 alert types × US regions. Key types: Tornado Warning, Hurricane Warning, Flood Warning, Blizzard Warning, Severe Thunderstorm, Winter Storm, Extreme Heat, etc.
- **Metrics:** Active alert count by type, total active alerts, alerts by state, highest severity level active
- **source_id:** `weather_alerts`
- **Config JSON assets:** 15 alert event types as assets
- **Note:** Fundamentally different from Open-Meteo (which provides forecasts/measurements). NWS provides official _warnings_ — discrete events with severity, urgency, and certainty.
- **Bet ideas:** "Tornado warning in Oklahoma today?", "Total active alerts >100?", "Hurricane warning issued this week?"

## Prerequisite: Asset Discovery Pipeline

### Problem

The prod AA system has a `refresh-assets` CLI binary that discovers new assets from upstream APIs and merges them into the static JSON config files. This was **not ported** to the Index data-node. Currently:

- 34 JSON config files exist in `data-node/src/config/` — compiled via `include_str!` at build time
- 12 sources implement `discover_upstream_assets()` — but nothing calls it
- The sync engine only uses `fetch_assets()` (reads from compiled JSON) and `fetch_prices()`
- No process exists to update the JSON configs when upstream APIs add/remove assets

### Solution: Port refresh-assets + Auto-Discovery

**Step 0a: Add `refresh-assets` subcommand** — Port `refresh_assets.rs` from AA as a new `data-node refresh-assets --source <id>` subcommand. It:
1. Reads existing `config/{source}.json` from disk (not compiled)
2. Calls `source.discover_upstream_assets()`
3. Merges: add new → active, missing upstream → deactivated, never deleted
4. Writes updated JSON back, sorted by asset_id for stable diffs
5. Supports `--dry-run` and `--output` flags

**Step 0b: Wire auto-discovery into sync engine** — On startup (after initial asset sync), if the source implements `discover_upstream_assets()`, call it and merge any new assets into `market_assets` DB table. This means:
- Static JSON configs remain the **seed** (compiled into binary)
- Runtime discovery **extends** the DB with new assets found upstream
- `refresh-assets` CLI is used periodically to update the JSON seed files (manual or cron)

**Step 0c: Implement `discover_upstream_assets()` for new sources** — Each of the 10 new sources should implement discovery where applicable (earthquake feeds, volcano catalogs, flight regions are mostly static; but ESPN teams, disease countries, etc. can be discovered).

### Discoverable Sources (existing + new)

| Source | Has `discover_upstream_assets()` | Discovery Method |
|--------|--------------------------------|------------------|
| crypto (CoinGecko) | Yes | Top N coins by market cap |
| defi (DefiLlama) | Yes | All protocols with TVL > 0 |
| polymarket | Yes | Active markets |
| steam | Yes | Top 500 games by player count |
| npm | Yes | Top 250 packages by downloads |
| pypi | Yes | Top 250 packages |
| crates_io | Yes | Top 250 crates |
| github | Yes | Trending repos |
| twitch | Yes | Top streams |
| twse | Yes | All listed stocks |
| anilist | Yes | Top anime/manga |
| cloudflare | Yes | Radar categories |
| backpacktf | Yes | All priced items |
| tmdb | Yes | Top movies/shows |
| **volcano** (new) | Yes | USGS elevated + GVP catalog |
| **earthquake** (new) | No | Static regions/magnitude bands |
| **spaceweather** (new) | No | Static metrics list |
| **wildfire** (new) | No | Static region bounding boxes |
| **flights** (new) | No | Static airport/region boxes |
| **maritime** (new) | Yes | AIS port vessel counts |
| **epidemic** (new) | Yes | disease.sh country list |
| **sports** (new) | Yes | ESPN team/league discovery |
| **iss** (new) | No | Static (5 metrics) |
| **weather_alerts** (new) | No | Static alert types |

## Architecture

All 10 sources follow the existing `MarketDataSource` trait pattern:
- `source_id()` — unique identifier
- `display_name()` — human-readable name
- `sync_interval()` — poll frequency
- `fetch_assets()` — return asset catalog
- `fetch_prices()` — return latest values per asset
- `discover_upstream_assets()` — optional: discover new assets from API

Each source gets:
- `data-node/src/market_data/sources/{name}/client.rs` — API client + MarketDataSource impl
- `data-node/src/market_data/sources/{name}/mod.rs` — module re-export
- `data-node/src/config/{name}.json` — asset catalog (seed)

Wiring: spawn in `main.rs` via `SyncEngine` (always-on sources) or `ScheduledSyncEngine` (market-hours sources).

## Asset Count Impact

| Source | Est. Assets | Poll |
|--------|------------|------|
| volcano | 50 | 10m |
| earthquake | 10 | 5m |
| spaceweather | 10 | 10m |
| wildfire | 20 | 30m |
| flights | 30 | 10m |
| maritime | 30 | 10m |
| epidemic | 35 | 30m |
| sports | 100 | 1-10m |
| iss | 5 | 10m |
| weather_alerts | 15 | 5m |
| **Total new** | **~305** | |

Combined with existing 58k assets → **~58,300 total assets** across **42 sources**.

## Dependencies

- `NASA_FIRMS_MAP_KEY` env var (free registration)
- `AISSTREAM_API_KEY` env var (free registration at aisstream.io)
- All other sources: zero auth, zero keys
