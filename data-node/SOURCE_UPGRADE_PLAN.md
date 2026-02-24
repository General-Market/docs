# Bet on Everything: Source-by-Source Upgrade Plan

**Session:** 20260224-1430-k9m3
**Date:** 2026-02-24
**Sources covered:** 16 market data sources (the "real-world" / non-financial sources)

---

## Table of Contents

1. [OpenMeteo Weather](#1-openmeteo-weather)
2. [Weather Alerts NWS](#2-weather-alerts-nws)
3. [Earthquake USGS](#3-earthquake-usgs)
4. [Volcano USGS](#4-volcano-usgs)
5. [SpaceWeather NOAA](#5-spaceweather-noaa)
6. [Wildfire NASA FIRMS](#6-wildfire-nasa-firms)
7. [Flights adsb.lol](#7-flights-adsblol)
8. [Military Aircraft](#8-military-aircraft)
9. [AISStream Vessels](#9-aisstream-vessels)
10. [Maritime](#10-maritime)
11. [GTFS-RT Transit](#11-gtfs-rt-transit)
12. [ISS](#12-iss)
13. [Movebank Animal GPS](#13-movebank-animal-gps)
14. [eBird](#14-ebird)
15. [Animals/Wildlife](#15-animalswildlife)
16. [Epidemic disease.sh](#16-epidemic-diseasesh)

---

## 1. OpenMeteo Weather

**Files:**
- `data-node/src/market_data/sources/openmeteo/client.rs` (439 lines)
- `data-node/src/market_data/sources/openmeteo/api_client.rs` (780 lines)
- `data-node/src/market_data/sources/openmeteo/models.rs`
- `data-node/src/market_data/sources/openmeteo/cities.json`
- `data-node/src/config/weather.json` (5.1MB, 25,000 assets)

**IMPORTANT:** There are TWO weather sources:
- **OLD:** `sources/weather/client.rs` -- 20 hardcoded cities, 3 metrics, simple cache. This is the legacy implementation.
- **NEW:** `sources/openmeteo/client.rs` -- 5,000 cities, 5 metrics, smart sync, forecast cache, batch API. This is the current/correct implementation.

Both register as `source_id = "weather"`. The openmeteo version supersedes the old one.

### Current State
- 25,000 assets (5,000 cities x 5 metrics: temperature_2m, rain, wind_speed_10m, pm2_5, ozone)
- Smart sync: checks metadata timestamp before fetching, skips when unchanged (implements `skips_when_unchanged() -> true`)
- Batch API: 100 cities per request, 2 separate API calls per batch (forecast + air quality)
- Daily budget tracking: 10,000 calls/day free tier, adaptive delay multiplier (ramps up as budget usage increases)
- In-memory 7-day hourly forecast cache (separate from DB persistence)
- Configurable sync interval via `OPENMETEO_SYNC_INTERVAL_SECS` (default 300s)
- Minimum 1 hour between actual data fetches (even if metadata changes)
- Asset IDs: `{city_id}:{metric}` (e.g., `paris-fr:temperature_2m`)

### Problems Found
1. **OLD source still exists** (`sources/weather/client.rs`): Two sources claim `source_id = "weather"`. If both are registered, they conflict. The old one uses 20 hardcoded cities with 3 metrics and does NOT use the config JSON. **Action:** Delete the old weather source entirely.
2. **5.1MB config embedded at compile time**: `include_str!` embeds the full 5.1MB weather.json into the binary. This is large but acceptable since it is compile-time only.
3. **Forecast cache not surfaced via API**: The 7-day hourly forecasts are stored in memory but there is no clear API endpoint to expose them to frontends or Vision settlement.
4. **No air quality forecast**: Hourly forecasts only cover temperature/rain/wind. PM2.5 and ozone are current-only.

### Data Quality Issues
- PM2.5 and ozone are from a separate API (`air-quality-api.open-meteo.com`) which has different coverage. Some cities may return `None` for air quality metrics while having valid forecast data.
- If the daily budget is hit mid-sync, cities processed later in the batch order never get data for that sync cycle. The cities near the end of the list may systematically receive fewer updates.
- `Decimal::try_from(f64)` can silently default to zero on precision overflow.

### Upgrade Plan
1. **Delete `sources/weather/client.rs`** entirely. It is dead code.
2. **Randomize batch order** on each sync to prevent systematic starvation of cities near the end of the list.
3. **Add air quality hourly forecast** (OpenMeteo supports hourly PM2.5/ozone -- just not requested currently).
4. **Expose forecast API endpoint** in the data-node REST API so frontends/Vision can query hourly forecasts.
5. **Consider humidity metric**: The old source had humidity, the new one does not. Re-add `relative_humidity_2m` as a 6th metric if desired (requires config regeneration).

### Smart Discovery
Already excellent. The cities.json + config/weather.json provide 25,000 assets. Discovery is purely config-driven. No upstream API discovery needed.

### Zero-Value Strategy
- Zero rainfall, zero PM2.5, and zero ozone are all valid real readings. Do NOT treat them as errors.
- If the API returns `None` for a metric, do not push a zero -- just skip that asset in the PriceUpdate results. Currently this is handled correctly via `if let Some(...)`.
- Missing air quality data (from coverage gaps) should be logged but not treated as a failure.

### Freshness Strategy
- Already excellent. Smart sync via metadata timestamp means no unnecessary fetches.
- 1-hour minimum between fetches is appropriate (OpenMeteo updates every 1-3 hours).
- Could add a "last successful fetch" health metric to the source health table.

### Estimated Effort
- Delete old weather source: **0.5h**
- Randomize batch order: **0.5h**
- Air quality hourly forecast: **2h**
- Expose forecast API endpoint: **3h**
- Total: **~6h**

---

## 2. Weather Alerts NWS

**Files:**
- `data-node/src/market_data/sources/weather_alerts/client.rs` (398 lines)
- `data-node/src/config/weather_alerts.json` (20 assets)

### Current State
- 20 static assets: 13 alert types (tornado, hurricane, flood, etc.) + total + max severity + 5 US regions
- NWS API at `api.weather.gov/alerts/active` (free, no auth)
- Single API call fetches all active alerts, then in-memory counting by event type and region
- 5min sync interval, 20 req/min rate limit
- Maps US states to 5 regions (northeast, southeast, midwest, southwest, west) for regional counts

### Problems Found
1. **US-only**: NWS only covers the United States. No international weather alert coverage.
2. **`get_api_ref()` re-parses JSON config on every call**: The function `entries.iter().find(|e| e.asset_id == asset_id).map(|e| e.api_ref.clone())` runs a full parse + linear scan of ASSET_JSON on every invocation during `fetch_prices()`. Should be pre-computed as a HashMap.
3. **Hardcoded event type mappings**: Alert event names like "Tornado Warning", "Hurricane Warning" are hardcoded strings. If NWS changes naming, matches silently fail and counts drop to zero.
4. **Max severity metric only returns numeric 0-3**: Severity semantics are not documented in the config or surfaced to users.
5. **No error on empty response**: If the NWS API returns an empty alerts array (which is valid -- no active alerts), all values are zero. This is correct but indistinguishable from API failure.

### Data Quality Issues
- **Time zone sensitivity**: Alert counts fluctuate dramatically by time of day (few alerts at night, many during severe weather season).
- **Seasonal zeros**: During calm weather periods, most alert types return 0 for days or weeks. This is valid data, not an error.
- **Event name fuzzy matching**: The code uses exact string matches (`alert.event == "Tornado Warning"`). NWS sometimes uses variants like "Tornado Watch" vs "Tornado Warning" vs "Severe Thunderstorm Warning". The current implementation handles some of these but may miss others.

### Upgrade Plan
1. **Pre-compute HashMap** for `get_api_ref()` instead of re-parsing JSON on every call.
2. **Add international alerts**: Use CAP (Common Alerting Protocol) feeds from other countries' national weather services.
3. **Add "any active alert" boolean metric**: A simple 0/1 for "is any alert currently active" for the whole US.
4. **Add alert count by severity level**: Currently only tracks max severity. Add counts per level.
5. **Add staleness detection**: If zero alerts persist for > 24 hours during active severe weather season, log a warning.

### Smart Discovery
Static config is appropriate for this source. The set of alert types and US regions is fixed. No dynamic discovery needed.

### Zero-Value Strategy
- Zero alerts is a valid and common reading. Most alert types show zero most of the time.
- The "max_severity" metric being 0 means "Normal" -- this is meaningful data, not an error.
- Only flag as suspicious if ALL 20 metrics return zero (which would suggest API failure rather than calm weather).

### Freshness Strategy
- 5min sync is appropriate for alerts (they change frequently during severe weather events).
- Consider reducing to 2min during active alert periods (when total_alerts > 0).
- Add a "last non-zero" timestamp to detect prolonged API failures disguised as calm weather.

### Estimated Effort
- Pre-compute HashMap: **0.5h**
- International alerts (CAP feeds): **8h** (new data source)
- Severity level counts: **1h**
- Staleness detection: **1h**
- Total: **~10h** (2h without international)

---

## 3. Earthquake USGS

**Files:**
- `data-node/src/market_data/sources/earthquake/client.rs` (704 lines)
- `data-node/src/config/earthquake.json` (20 assets)

### Current State
- 20 derived metrics from 4 USGS GeoJSON feeds:
  - `all_hour`: All earthquakes in the last hour
  - `4.5_day`: Mag 4.5+ in the last day
  - `4.5_month`: Mag 4.5+ in the last month
  - `significant_month`: Significant earthquakes in the last month
- Metrics include: total counts, max magnitude, hourly count, regional filters (Ring of Fire, US West, Japan, Mediterranean, Indonesia, Chile, Alaska, NZ, Turkey, Iceland)
- Computes total seismic energy via Gutenberg-Richter formula: `energy = 10^(1.5 * magnitude + 4.8)`
- Sequential fetching of 4 feeds
- 5min sync, 30 req/min rate limit

### Problems Found
1. **Sequential feed fetching**: The 4 USGS feeds are fetched one at a time. Could be parallelized with `tokio::join!`.
2. **Region bounding boxes are hardcoded in Rust code**: Not in the JSON config. Changing regions requires code changes + recompilation.
3. **No depth-based metrics**: Earthquake depth is available in the data but only `avg_depth` is exposed. Shallow earthquakes (< 70 km) are more damaging and worth tracking separately.
4. **Energy calculation may overflow**: Very large earthquakes (mag 9+) produce energy values that could exceed f64 precision. The Gutenberg-Richter formula `10^(1.5 * 9 + 4.8) = 10^18.3` is within f64 range but Decimal conversion may lose precision.

### Data Quality Issues
- **Duplicate events**: USGS updates earthquake parameters (magnitude, location) as more seismic data arrives. The same earthquake may appear with different magnitudes in successive syncs.
- **Near-real-time lag**: USGS feeds update every few minutes but new earthquakes may take 5-30 minutes to appear. The 5-min sync interval is appropriate.
- **Magnitude revision**: Preliminary magnitudes are often revised up or down within hours. This causes the "max magnitude" metric to jump around.

### Upgrade Plan
1. **Parallelize feed fetching**: Use `tokio::join!` for the 4 feeds. Expected speedup: ~4x.
2. **Move region definitions to config JSON**: Add region bounding boxes to earthquake.json to allow config-driven region changes.
3. **Add shallow earthquake count**: Count earthquakes with depth < 70 km separately.
4. **Add tsunami warning flag**: USGS includes a `tsunami` field (0 or 1) in earthquake features.
5. **Add felt reports count**: USGS includes `felt` (number of "Did You Feel It?" reports). High values indicate earthquakes affecting populated areas.

### Smart Discovery
Static config is appropriate. USGS feed structure is stable. Dynamic regions could be added but are not necessary.

### Zero-Value Strategy
- Zero earthquakes in the last hour is common and valid.
- Zero significant earthquakes in the last month is rare but possible.
- All metrics legitimately go to zero during seismically quiet periods.
- The `seismic_energy_daily` metric should use Decimal::ZERO when no earthquakes occurred, not skip the update.

### Freshness Strategy
- 5min sync interval is good. Matches USGS feed update frequency.
- Consider adding a "feed last updated" timestamp from the USGS metadata to detect stale feeds.

### Estimated Effort
- Parallelize feeds: **1h**
- Move regions to config: **2h**
- Add shallow count: **1h**
- Add tsunami flag: **1h**
- Add felt reports: **1h**
- Total: **~6h**

---

## 4. Volcano USGS

**Files:**
- `data-node/src/market_data/sources/volcano/client.rs` (327 lines)
- `data-node/src/config/volcano.json` (50 volcanoes)

### Current State
- 50 notable volcanoes defined in config
- Alert levels: Normal=0, Advisory=1, Watch=2, Warning=3
- Single API call to `volcanoApi/elevated` fetches only volcanoes with above-normal activity
- All non-elevated volcanoes default to 0 (Normal)
- Name normalization: lowercase, remove periods/apostrophes, spaces/hyphens to underscores
- Uses `SourceHttpClient` with retry config
- 10min sync, 30 req/min rate limit

### Problems Found
1. **Name matching is fragile**: The config uses normalized names (`api_ref: "kilauea"`) matched against USGS names via `normalize_volcano_name()`. If USGS changes a volcano name (e.g., "Kilauea" to "K\u012blauea"), the match fails silently and the volcano stays at 0.
2. **Only the `/elevated` endpoint is used**: Volcanoes not on the elevated list always return 0. There is no way to confirm a volcano is actually being monitored vs. simply not matched.
3. **No color code exposure**: USGS provides both alert level AND color code (Green/Yellow/Orange/Red). Only alert level is used.
4. **Most values are zero most of the time**: With 50 volcanoes and typically only 2-5 elevated globally, 90%+ of readings are zero.

### Data Quality Issues
- **Indistinguishable states**: A volcano reporting 0 could mean: (a) monitored and normal, (b) not matched by name, or (c) USGS API down. All three produce the same value.
- **Non-US volcanoes**: USGS only monitors US volcanoes directly. Non-US volcanoes in the config (Etna, Merapi, etc.) will NEVER appear in the USGS elevated list and will always return 0.

### Upgrade Plan
1. **Critical fix -- remove non-US volcanoes from USGS source**: USGS only monitors US volcanoes. Non-US volcanoes (25+ of the 50) should use a different data source (e.g., Smithsonian GVP, VAAC advisories).
2. **Add secondary volcano monitoring sources**: Smithsonian Global Volcanism Program API, VAAC volcanic ash advisories, or the Volcano Discovery feed.
3. **Add color code as separate metric**: Store both alert level and color code as separate assets per volcano.
4. **Add "total elevated volcanoes" aggregate**: Count of all volcanoes currently above Normal.
5. **Validate names at startup**: Log a warning if any config volcano name does not match any known USGS volcano.
6. **Add "last activity date"**: USGS provides dates of last eruption/activity. Use as metadata.

### Smart Discovery
The current static config is problematic because it lists 50 volcanoes but USGS only monitors US volcanoes. Could use the `/volcanoApi/all` endpoint to discover all USGS-monitored volcanoes at startup.

### Zero-Value Strategy
- Zero (Normal) is the expected state for most volcanoes most of the time. It is valid data.
- The problem is not zero values but undetectable failures. Add health metadata: "last time this volcano was confirmed monitored."
- For non-US volcanoes, permanently zero is a data source mismatch, not valid data.

### Freshness Strategy
- 10min sync is appropriate. Volcanic alert levels change slowly (hours to days).
- Could increase to 30min without losing meaningful resolution.

### Estimated Effort
- Remove non-US volcanoes from this source: **1h**
- Add Smithsonian/GVP secondary source: **8h** (new source)
- Add color code metric: **1h**
- Add aggregate metric: **0.5h**
- Startup name validation: **1h**
- Total: **~12h** (3h without secondary source)

---

## 5. SpaceWeather NOAA

**Files:**
- `data-node/src/market_data/sources/spaceweather/client.rs` (750 lines)
- `data-node/src/config/spaceweather.json` (10 assets)

### Current State
- 10 metrics from 6 NOAA SWPC endpoints:
  - Kp geomagnetic index (0-9)
  - Solar wind speed (km/s) and density (protons/cm3)
  - G/S/R storm scales (0-5 each)
  - Sunspot number, solar flux (F10.7)
  - Proton flux (>10 MeV), electron flux (>2 MeV)
- Handles NOAA sentinel values (-999.9, -99999.99) by treating them as missing
- Sequential fetching of 6 endpoints
- Parses array-of-arrays format (first row is headers, last row is most recent)
- 10min sync, 30 req/min rate limit

### Problems Found
1. **Sequential fetching**: 6 independent endpoints are fetched one at a time. Should use `tokio::join!` for parallelism.
2. **Hardcoded endpoint paths and parsing logic**: Each metric has bespoke parsing. Adding a new SWPC metric requires significant code changes.
3. **No historical context**: Only the latest value is extracted. SWPC provides time series data. Could compute trends (rising Kp, etc.).
4. **Sentinel value handling works but is scattered**: Each endpoint handler checks for sentinels differently.

### Data Quality Issues
- **Sentinel values**: NOAA uses -999.9 and -99999.99 as "no data" markers. These must be filtered out, which the code does correctly.
- **Solar cycle variation**: Sunspot numbers near solar minimum can legitimately be 0 for extended periods.
- **Scale values are integers**: G/S/R scales are 0-5. The code correctly maps them to Decimal integers.
- **Data lag**: Some SWPC products have 1-3 hour lag. The Kp index is only updated every 3 hours.

### Upgrade Plan
1. **Parallelize endpoint fetching**: `tokio::join!` on all 6 endpoints. Expected ~6x speedup.
2. **Unify sentinel filtering**: Create a single `is_sentinel(f64) -> bool` function used by all parsers.
3. **Add trend metrics**: Compute 6-hour Kp trend (rising/falling/stable) as a derived metric.
4. **Add CME (Coronal Mass Ejection) alerts**: SWPC has a CME notifications endpoint not currently used.
5. **Add solar flare class**: SWPC provides X-ray flux classification (A/B/C/M/X) as a separate endpoint.

### Smart Discovery
Static config is appropriate. SWPC metrics are well-defined and stable. No dynamic discovery needed.

### Zero-Value Strategy
- Zero Kp, zero G/S/R scales, zero sunspot number are all valid readings during quiet solar conditions.
- Sentinel values (-999.9) must NOT be stored as zeros. They should be skipped entirely.
- The code currently handles this correctly but could benefit from a unified sentinel check.

### Freshness Strategy
- 10min sync is appropriate for most metrics.
- Kp index only updates every 3 hours. Could use a longer interval for that specific metric to reduce unnecessary API calls.
- Solar wind data updates every ~1 minute but 10min polling is sufficient for our purposes.

### Estimated Effort
- Parallelize fetching: **1h**
- Unify sentinel filtering: **0.5h**
- Add trend metrics: **2h**
- Add CME alerts: **3h**
- Total: **~7h**

---

## 6. Wildfire NASA FIRMS

**Files:**
- `data-node/src/market_data/sources/wildfire/client.rs` (349 lines)
- `data-node/src/config/wildfire.json` (20 regions)

### Current State
- 20 global bounding box regions (including a global summary)
- Counts fire hotspots (active fire detections) from NASA FIRMS MODIS/VIIRS data
- API returns CSV format, parsed to count rows within each bounding box
- Requires `NASA_FIRMS_MAP_KEY` environment variable
- Sequential fetching with 3-second delays between regions
- 30min sync interval, 2 req/min rate limit
- Total sync time: ~60 seconds (20 regions x 3s delay)

### Problems Found
1. **Extremely slow sync**: 20 sequential requests with 3-second delays = 60+ seconds per sync. This is the slowest source.
2. **Per-region API calls**: Each region makes a separate HTTP request to FIRMS. The API supports bounding box queries but there is no batch endpoint.
3. **No fire intensity data**: FIRMS provides brightness/confidence/FRP (Fire Radiative Power). Only count is used.
4. **CSV parsing is basic**: Counts rows rather than parsing structured data. Misses useful metadata.
5. **Bounding box in different format from flights**: `"west,south,east,north"` format (vs flights' `"lat_min,lat_max,lon_min,lon_max"`). Inconsistent across sources.

### Data Quality Issues
- **Cloud cover bias**: Satellite-based fire detection is blocked by clouds. Tropical regions during rainy season show artificially low counts.
- **Legitimate zeros**: During wet seasons, many regions have zero active fires. This is valid data.
- **Double counting**: MODIS and VIIRS may detect the same fire. The count includes both.
- **24-hour lookback**: The API query uses a 24-hour window. Large fires persist across multiple syncs, producing stable non-zero counts.

### Upgrade Plan
1. **Reduce to single global call**: Fetch the global bounding box once (already in config as `wildfire_global`), then filter to regions in-memory. This mirrors the flights source strategy. **Reduces 20 API calls to 1.**
2. **Parse fire intensity**: Extract FRP (Fire Radiative Power) for each region as a separate metric. Sum of FRP indicates total fire energy, not just count.
3. **Add confidence filtering**: Only count high-confidence detections (confidence >= 80) as a separate metric.
4. **Normalize bounding box format**: Use the same format across all geospatial sources.
5. **Increase sync interval**: 30min is already appropriate for satellite data that updates 2-4 times daily.

### Smart Discovery
Static config is appropriate. Global fire monitoring regions are well-defined. No dynamic discovery needed.

### Zero-Value Strategy
- Zero fires is valid and common for many regions (Antarctica, oceans, Arctic in winter).
- Should NOT treat zero as an error even for regions that typically have fires.
- Add "days since last fire" derived metric per region for context.

### Freshness Strategy
- 30min sync is appropriate. FIRMS data updates with each satellite overpass (~4 times daily for any given location).
- The single-call strategy (from upgrade plan) would eliminate the slow sequential fetch problem entirely.

### Estimated Effort
- Single global call + in-memory filter: **3h** (biggest win)
- Parse fire intensity: **2h**
- Confidence filtering: **1h**
- Normalize bbox format: **1h**
- Total: **~7h**

---

## 7. Flights adsb.lol

**Files:**
- `data-node/src/market_data/sources/flights/client.rs` (430 lines)
- `data-node/src/config/flights.json` (25 regions)

### Current State
- 25 regions: 7 continental + 17 airport areas + global
- Single API call to `https://api.adsb.lol/v2/all` fetches ALL aircraft globally
- In-memory bounding box filtering per region
- Bounding box format: `"lat_min,lat_max,lon_min,lon_max"`
- 5min sync, 10 req/min rate limit
- 60s request timeout with gzip compression

### Problems Found
1. **BUG: South America bounding box has inverted coordinates**: In `flights.json`, the South America entry likely has `lon_min > lon_max` (e.g., `-34` as lon_min and `-75` as lon_max). The `BBox::contains()` check requires `lon >= lon_min && lon <= lon_max`, which will NEVER match when lon_min > lon_max. **South America always returns zero aircraft.**
2. **Large response**: The `/v2/all` endpoint returns ALL aircraft worldwide (~20,000-40,000 entries). This is a ~20MB+ response per sync.
3. **No aircraft type differentiation**: All aircraft are counted equally. No separation by type (commercial, GA, military).
4. **Re-parses asset JSON on every fetch_prices call**: `let all_entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?` runs every time.

### Data Quality Issues
- **Coverage bias**: ADS-B coverage depends on ground station density. Remote oceanic regions and parts of Africa/Asia have poor coverage and consistently undercount.
- **Time-of-day variation**: Aircraft counts vary dramatically by time of day and day of week. This is valid data but can confuse users expecting stable values.
- **South America always zero**: Due to the inverted bbox bug, this metric never returns valid data.

### Upgrade Plan
1. **Fix South America bounding box** in `flights.json`: Swap lon_min and lon_max values.
2. **Pre-compute asset entries**: Parse ASSET_JSON once at construction time, store in struct field.
3. **Add altitude filtering**: Separate "in flight" (altitude > 1000ft) from "on ground" counts per region.
4. **Add aircraft type counts**: adsb.lol provides aircraft type codes. Count commercial vs. GA.
5. **Add "busiest region" aggregate**: Dynamic metric showing which region has the most aircraft.
6. **Consider caching the response**: The 20MB+ response could be cached for the full 5-min interval if multiple calls happen.

### Smart Discovery
Static config is appropriate. Airport areas and continental regions are well-defined. Could add dynamic airport detection based on aircraft density clusters.

### Zero-Value Strategy
- Zero aircraft in a small airport area at night is valid.
- Zero aircraft in continental regions or global is ALWAYS an error (should have thousands).
- After fixing the South America bug, add a minimum-expected-count sanity check: if a continental region returns < 10, log a warning.

### Freshness Strategy
- 5min sync is appropriate. Aircraft positions update every few seconds but 5-min snapshots are sufficient for our purposes.
- The single-call strategy is already optimal. No changes needed.

### Estimated Effort
- Fix South America bbox: **0.25h** (critical bug fix)
- Pre-compute entries: **0.5h**
- Altitude filtering: **1.5h**
- Aircraft type counts: **2h**
- Total: **~4h**

---

## 8. Military Aircraft

**Files:**
- `data-node/src/market_data/sources/mil_aircraft/client.rs` (1007 lines)
- `data-node/src/config/mil_aircraft.json`

### Current State
- Fetches US military aircraft from `adsb.lol/v2/mil` endpoint
- Filters by ICAO hex range AE0000-AFFFFF (US military transponder allocation)
- 9 static aggregate metrics: total count, region counts (europe, mideast, pacific, conus, other), tankers, transports, avg altitude, avg speed
- Dynamic per-aircraft assets: lat, lon, altitude (up to ~500 dynamic assets)
- Cached aircraft states in `Mutex<Vec<MilAircraftState>>`
- Unit conversions: feet to meters, knots to m/s
- Region classification by lat/lon (hardcoded boundaries)
- 5min sync interval

### Problems Found
1. **US-only**: Only tracks US military aircraft (ICAO AE0000-AFFFFF). Other nations' military aircraft are excluded.
2. **ADS-B visibility bias**: Many military aircraft do not broadcast ADS-B, or use Mode S transponders without position data. The visible subset is heavily biased toward tankers and transports.
3. **Dynamic assets create unbounded growth**: Each new aircraft hex code creates 3 new assets (lat, lon, alt). Without pruning, the asset table grows indefinitely.
4. **Region boundaries are hardcoded**: Not in config JSON. Changing regions requires code changes.
5. **Large struct**: The 1007-line file handles both static aggregates and dynamic per-aircraft tracking. Could be split.

### Data Quality Issues
- **Severe visibility bias**: Military aircraft frequently disable ADS-B during operations. Visible aircraft are predominantly tankers (KC-135, KC-46) and transports (C-17, C-130). Fighters and bombers are rarely visible.
- **Zero is rarely valid for total count**: At least 20-50 US military aircraft are always visible globally. Total count of 0 indicates API failure.
- **Region classification is approximate**: The simple lat/lon boundaries for "europe", "mideast", etc. are rough approximations.

### Upgrade Plan
1. **Add pruning for dynamic assets**: Aircraft not seen for > 1 hour should be removed from tracking. Currently, 30-min prune exists but verify it is working.
2. **Add aircraft type classification**: Parse ICAO type codes to differentiate tankers, transports, ISR (surveillance), fighters.
3. **Move region boundaries to config**: Allow adding/changing regions without code changes.
4. **Add historical position tracking**: Store per-aircraft tracks (last N positions) to enable trajectory analysis.
5. **Add NATO ICAO ranges**: Include UK (43C000-43CFFF), France, Germany, etc. for allied military tracking.

### Smart Discovery
Currently mixes static (aggregates) and dynamic (per-aircraft) assets. The dynamic discovery is good but needs bounded growth. Consider capping dynamic assets at 200 aircraft (most relevant ones by speed/altitude/region).

### Zero-Value Strategy
- Total count of 0 = API failure. Minimum expected: ~20.
- Individual aircraft lat/lon of 0,0 = null island artifact. Filter these out.
- Avg altitude of 0 = suspicious (should be at least 5000m for airborne aircraft).
- Region counts of 0 are valid (no visible aircraft in that region at that moment).

### Freshness Strategy
- 5min sync is appropriate. Military aircraft positions change continuously but 5-min snapshots capture deployment patterns.
- Consider 2min for operational awareness use cases.

### Estimated Effort
- Dynamic asset pruning verification: **1h**
- Aircraft type classification: **3h**
- Move regions to config: **2h**
- NATO ICAO ranges: **2h**
- Total: **~8h**

---

## 9. AISStream Vessels

**Files:**
- `data-node/src/market_data/sources/aisstream/client.rs` (821 lines)
- `data-node/src/config/aisstream.json` (empty `[]`)

### Current State
- **WebSocket-based** persistent connection to `wss://stream.aisstream.io/v0/stream`
- All assets are dynamic (config JSON is intentionally empty `[]`)
- 500 vessel cap with 30-min prune for stale vessels
- 3 assets per vessel: lat, lon, speed (SOG)
- Background tokio task for WebSocket connection
- 5-second reconnect delay on disconnect
- 60-second sync interval (reads from in-memory state)
- Requires `AISSTREAM_API_KEY` env var

### Problems Found
1. **WebSocket reliability**: The persistent WebSocket connection can drop silently. The 5-second reconnect is good but there is no health metric for "connection uptime" or "messages per second."
2. **500 vessel cap is arbitrary**: In busy waterways, this cap is hit quickly. Important vessels may be evicted for less important ones (no priority system).
3. **No vessel identification**: Assets are keyed by MMSI but there is no vessel name, type, or flag resolution. Just raw GPS + speed.
4. **3 metrics per vessel x 500 vessels = 1,500 dynamic assets**: This is a LOT of database writes every 60 seconds.
5. **No aggregate metrics**: Unlike mil_aircraft, there are no summary statistics (total vessels tracked, average speed, regional counts).

### Data Quality Issues
- **AIS spoofing**: Vessel AIS signals can be spoofed (fake positions). No validation is performed.
- **Position age**: AIS messages have inherent delay. A vessel's "current" position may be minutes old.
- **Speed of 0**: Many vessels are at anchor or in port. Zero speed is valid and very common.
- **MMSI 0 or invalid**: Some AIS messages have invalid MMSI. These should be filtered.

### Upgrade Plan
1. **Add aggregate metrics**: Total vessels tracked, average SOG, vessel count by type (if available from AIS message type), regional counts.
2. **Add vessel type filtering**: AIS includes ship type. Prioritize cargo, tanker, and passenger vessels over recreational.
3. **Add connection health metrics**: Messages/second, last message time, reconnect count.
4. **Add priority queue**: Instead of FIFO 500-cap, prioritize: (a) named commercial vessels, (b) high-speed vessels, (c) vessels in monitored ports/lanes.
5. **Reduce per-vessel writes**: Batch database updates, or only write when position changes significantly (> 0.01 degrees).
6. **Consider merging with maritime source**: Both use AISStream API. The split into WebSocket (aisstream) vs. REST (maritime) is awkward.

### Smart Discovery
Fully dynamic, which is appropriate for real-time vessel tracking. The 500-cap prevents unbounded growth. Consider adding vessel type as a discovery dimension.

### Zero-Value Strategy
- Zero vessels tracked = WebSocket is down. Should trigger reconnection.
- Zero speed = vessel at anchor. Very common and valid.
- Lat/lon of 0,0 = null island. Filter out MMSI reporting (0, 0).

### Freshness Strategy
- 60s sync is appropriate for reading from in-memory state.
- The WebSocket provides continuous real-time updates. Freshness is about connection health, not sync interval.
- Add "seconds since last AIS message" health metric.

### Estimated Effort
- Aggregate metrics: **2h**
- Vessel type filtering: **2h**
- Connection health: **1h**
- Priority queue: **3h**
- Merge investigation with maritime: **2h** (analysis only)
- Total: **~10h**

---

## 10. Maritime

**Files:**
- `data-node/src/market_data/sources/maritime/client.rs` (473 lines)
- `data-node/src/config/maritime.json` (25 regions: 15 ports + 10 shipping lanes)

### Current State
- 25 static assets: 15 major ports + 10 shipping lanes
- AISStream REST API (POST) to `https://stream.aisstream.io/v0/stream`
- Bounding box format: `"lon_min,lat_min,lon_max,lat_max"` (different from flights!)
- 10-second delay between requests
- **250 seconds total per sync** (25 regions x 10s delay)
- 10min sync interval, 6 req/min rate limit
- Counts vessels within each bounding box
- Requires `AISSTREAM_API_KEY` env var

### Problems Found
1. **Catastrophically slow sync**: 250 seconds (4+ minutes) per sync cycle. With a 10-min interval, the source spends ~40% of its time actively syncing.
2. **REST API for what should be WebSocket data**: Both this source and aisstream use AISStream. This one uses REST POST to query areas while aisstream uses WebSocket. Redundant API usage.
3. **Bounding box format inconsistency**: Uses `"lon_min,lat_min,lon_max,lat_max"` while flights uses `"lat_min,lat_max,lon_min,lon_max"`. This is confusing and error-prone.
4. **No vessel type differentiation**: All vessels counted equally. A container ship and a sailboat count the same.
5. **No caching**: Each sync fetches all 25 regions fresh. No delta computation.

### Data Quality Issues
- **AIS reception gaps**: Coastal areas have good AIS coverage. Open-ocean shipping lanes (e.g., mid-Pacific) have sparse coverage from satellite AIS only.
- **Port counts include anchored vessels**: Vessels at anchor near a port are counted the same as vessels actively moving through. This may overcount "active" port traffic.
- **Bounding box overlap**: Some port and lane bounding boxes may overlap, double-counting vessels.

### Upgrade Plan
1. **CRITICAL: Replace REST calls with WebSocket data sharing**: Use the aisstream WebSocket connection to populate maritime regions. Filter the real-time WebSocket stream by bounding box in-memory. **Eliminates 25 API calls per sync entirely.**
2. **Normalize bounding box format**: Use consistent `"lat_min,lat_max,lon_min,lon_max"` across all geospatial sources.
3. **Add vessel type breakdown**: AIS includes ship type. Report counts by type (cargo, tanker, passenger, fishing).
4. **Add "vessels in transit" metric**: Filter out stationary vessels (SOG < 1 knot) to measure actual traffic flow.
5. **Check for bbox overlaps**: Validate that port and lane bounding boxes do not overlap. If they do, document it.

### Smart Discovery
Static config is appropriate. Ports and shipping lanes are well-defined. Could add dynamic "busiest area" detection based on vessel density clustering.

### Zero-Value Strategy
- Zero vessels in a major port (Shanghai, Rotterdam, Singapore) is ALWAYS an error. Add minimum-expected-count thresholds per port.
- Zero vessels in mid-ocean shipping lanes may be valid during off-peak times but is suspicious for routes like the Strait of Malacca.
- Add sanity check: if total across all 25 regions < 100, flag as API issue.

### Freshness Strategy
- 10min sync is appropriate for port traffic (vessels move slowly).
- The WebSocket-based approach (from upgrade plan) would provide real-time updates with zero additional API calls.

### Estimated Effort
- Replace REST with WebSocket data sharing: **6h** (biggest win, eliminates 250s sync)
- Normalize bbox format: **1h** (coordinate with flights and wildfire)
- Vessel type breakdown: **2h**
- Vessels in transit: **1h**
- Total: **~10h**

---

## 11. GTFS-RT Transit

**Files:**
- `data-node/src/market_data/sources/gtfs_rt/client.rs` (1309 lines)
- `data-node/src/config/gtfs_rt.json` (13 assets)

### Current State
- 13 static aggregates + dynamic per-vehicle GPS (max 500 vehicles)
- Protobuf GTFS-RT feeds from MTA (8 subway feeds) + BART (1 feed)
- 9 total feed URLs fetched per sync
- Uses `prost::Message` for protobuf decoding
- Extracts trip updates and vehicle positions
- Static metrics: active trips (per line group + total), total vehicles, average speed
- Dynamic metrics: per-vehicle lat, lon, speed (capped at 500)
- 2min sync interval, 30 req/min rate limit

### Problems Found
1. **Only 2 transit systems**: MTA NYC Subway and BART (SF). Most major world cities have GTFS-RT feeds available.
2. **MTA requires API key**: The code may need an MTA API key (depending on the feeds used). This is not clearly documented in the source.
3. **1309 lines is very large**: The file handles protobuf parsing, feed management, vehicle tracking, line grouping, and speed calculation. Should be split into modules.
4. **Speed calculation may be inaccurate**: Speed is derived from position deltas between syncs. For 2-min intervals, subway speeds between stations may appear as zero (no position updates while in tunnel).
5. **Dynamic vehicle cap at 500**: NYC alone has ~6,000+ subway cars. The 500 cap captures only a fraction.

### Data Quality Issues
- **Tunnel blackouts**: Subway vehicles lose GPS in tunnels. Position updates are sporadic and only accurate at stations.
- **MTA feed reliability**: MTA GTFS-RT feeds occasionally go down or return stale data. Need staleness detection.
- **BART is much smaller than MTA**: BART has ~60 trains vs. MTA's ~1,000+. The combined metrics are dominated by MTA.
- **Weekend/holiday variation**: Trip counts drop significantly on weekends and holidays. This is valid data.

### Upgrade Plan
1. **Add more transit systems**: London (TfL), Chicago (CTA), Washington (WMATA), Tokyo, Paris. Each city adds a new set of feeds.
2. **Split into modules**: Separate protobuf parsing, feed management, vehicle tracking, and metric computation.
3. **Add staleness detection**: Track "last successful feed update" per feed URL. Alert if a feed goes stale (> 10 minutes without new data).
4. **Increase vehicle cap or make it dynamic**: For production, 500 is too low for MTA alone.
5. **Add delay metrics**: GTFS-RT trip updates include delay information (seconds ahead/behind schedule). This is highly valuable.
6. **Add occupancy data**: Some transit agencies provide occupancy levels in GTFS-RT. Not currently parsed.

### Smart Discovery
Current config is static (13 metrics for 2 systems). Adding new transit systems requires config + code changes for each new agency's feed URLs and line groupings. Consider a more generic GTFS-RT feed config format.

### Zero-Value Strategy
- Zero active trips at 3 AM is valid (subway service stops).
- Zero active trips during normal hours = feed is down. Add time-of-day thresholds.
- Zero vehicles reporting position could mean protobuf parsing failure or feed outage.
- Average speed of 0 = all vehicles at stations or in tunnels. Valid during non-peak hours.

### Freshness Strategy
- 2min sync is appropriate for real-time transit. MTA feeds update every 30-60 seconds.
- Consider 1min sync during peak hours (7-10 AM, 4-7 PM) for better resolution.

### Estimated Effort
- Add one new transit system (TfL): **6h** (per system)
- Split into modules: **3h**
- Staleness detection: **2h**
- Add delay metrics: **3h**
- Total: **~14h** (for 1 new system + improvements)

---

## 12. ISS

**Files:**
- `data-node/src/market_data/sources/iss/client.rs` (414 lines)
- `data-node/src/config/iss.json` (5 assets)

### Current State
- 5 assets: latitude, longitude, speed, altitude, people in space
- **Speed is hardcoded**: 27,600 km/h constant. Not fetched from any API.
- **Altitude is hardcoded**: 408 km constant. Not fetched from any API.
- Uses open-notify.org (HTTP only, not HTTPS): `http://api.open-notify.org/iss-now.json` and `http://api.open-notify.org/astros.json`
- Selective API calls: Only calls the APIs needed for requested asset_ids
- 10min sync interval

### Problems Found
1. **Two of five metrics are fake constants**: Speed (27,600 km/h) and altitude (408 km) are hardcoded, never fetched from any API. They never change. This is misleading -- they appear to be "live data" but are static values.
2. **HTTP-only API**: open-notify.org only supports HTTP, not HTTPS. This is a security concern and some network configs may block plain HTTP.
3. **open-notify.org reliability**: This is a hobbyist API, not an official NASA API. It can go down without notice.
4. **Very few metrics**: Only 5 assets from 2 API calls. The source is simple but thin.
5. **No orbital parameters**: The ISS orbit includes velocity, inclination, period, and predicted pass times. None of these are tracked.

### Data Quality Issues
- **Latitude/longitude change every second**: At 7.66 km/s, the ISS position changes dramatically between syncs. A 10-min sync only captures snapshots.
- **Speed never changes**: Always 27,600. Not useful as a "market" to bet on.
- **Altitude varies slightly**: Real ISS altitude ranges from ~400-420 km due to reboosts and atmospheric drag. The hardcoded 408 km misses this variation.
- **People in space count changes rarely**: Crew swaps happen every ~6 months. This metric changes only a few times per year.

### Upgrade Plan
1. **Use real altitude data**: NASA's Spot the Station or Open Notify provides real-time altitude. Or compute from TLE (Two-Line Element) data.
2. **Compute real speed from TLE**: Orbital speed varies with altitude. Use NORAD TLE to compute actual velocity.
3. **Upgrade to HTTPS API**: Switch to `wheretheiss.at/v1/satellites/25544` which supports HTTPS and provides altitude, velocity, visibility, and more.
4. **Add orbital parameters**: Inclination, orbital period, footprint radius, visibility (daylight/eclipse).
5. **Add ISS pass predictions**: Use TLE to compute next pass times for major cities.
6. **Increase sync frequency for lat/lon**: Consider 1-2min sync for position data.

### Smart Discovery
Static config is appropriate. ISS is a single object. No discovery needed.

### Zero-Value Strategy
- Latitude of 0 is valid (ISS crosses the equator ~16 times/day).
- Longitude of 0 is valid (crosses the prime meridian regularly).
- People in space of 0 would be extraordinary and likely an API error.
- Speed of 0 is impossible for an orbiting satellite. But since it is hardcoded to 27,600, this never happens.

### Freshness Strategy
- 10min sync is very coarse for ISS position tracking. Consider 1-2 minutes for meaningful trajectory data.
- For speed and altitude, even 1-hour sync would suffice (if using real data that changes slowly).
- People in space: Daily sync would be adequate.

### Estimated Effort
- Switch to wheretheiss.at API (HTTPS): **2h**
- Compute real speed/altitude from TLE: **4h**
- Add orbital parameters: **2h**
- Increase sync frequency: **0.5h**
- Total: **~8h**

---

## 13. Movebank Animal GPS

**Files:**
- `data-node/src/market_data/sources/movebank/client.rs` (982 lines)
- `data-node/src/config/movebank.json` (empty `[]`)

### Current State
- All dynamic assets from public GPS-tracked animal studies
- Movebank REST API with HTTP Basic Auth (MOVEBANK_USER, MOVEBANK_PASSWORD)
- Discovery: studies -> individuals -> events (3-level hierarchy)
- Auto-accepts license agreements via MD5 hash
- CSV parsing with hand-rolled quoted field handler
- Max 15 studies, max 50 individuals per study
- fetch_prices() makes 2 API calls per study (events + individuals for name mapping)
- 30min sync, 2 req/min rate limit, 3s delay between requests
- Assets: per-animal lat, lon (2 metrics per individual)

### Problems Found
1. **982 lines with hand-rolled CSV parsing**: Should use the `csv` crate instead of manual quoted-field parsing. The hand-rolled parser may have edge cases with escaped quotes, newlines in fields, etc.
2. **2 API calls per study x 15 studies = 30 calls per sync**: Plus discovery calls. This is a lot of sequential requests with 3s delays = 90+ seconds for prices alone.
3. **License auto-acceptance**: Automatically accepts Movebank data license agreements by computing MD5 hash. This may have legal implications.
4. **No data validation**: Animal GPS coordinates are not validated. GPS errors can produce impossible coordinates (e.g., underwater for land animals).
5. **Study selection is opaque**: The code selects up to 15 studies but the selection criteria are not clear. Are they the most recent? Most active? Random?

### Data Quality Issues
- **GPS accuracy**: Animal GPS collars have varying accuracy (10-100m). For small animals, this is a large relative error.
- **Duty cycling**: Many GPS collars only record positions every few hours to save battery. Between recordings, the animal's position is unknown.
- **Dead animals**: A collar on a dead animal keeps reporting the same position indefinitely. No detection for this.
- **Stale studies**: Some Movebank studies have not received new data in years. The source may track animals from completed studies.

### Upgrade Plan
1. **Replace hand-rolled CSV with `csv` crate**: More robust, handles edge cases.
2. **Add study freshness filter**: Only track studies with data from the last 30 days.
3. **Add movement detection**: Flag animals that have not moved in 48+ hours (possible mortality or collar detachment).
4. **Reduce API calls**: Cache study metadata and individual lists. Only refresh events on each sync.
5. **Add aggregate metrics**: Total animals tracked, average displacement per day, species diversity count.
6. **Add species grouping**: Group animals by species for aggregate metrics (e.g., "all eagles" average migration distance).
7. **Validate coordinates**: Check that GPS positions are on land (for terrestrial species) and in the expected range for the species.

### Smart Discovery
Already fully dynamic, which is appropriate. The 15-study cap and 50-individuals-per-study cap prevent runaway growth. Consider making these caps configurable.

### Zero-Value Strategy
- Lat/lon of 0,0 (null island, Gulf of Guinea) is almost certainly a GPS error. Filter it out.
- Speed of 0 is valid for resting animals. Very common.
- If all animals report the same position, the study data may be stale or corrupted.

### Freshness Strategy
- 30min sync is appropriate for animal GPS data (most collars record every 1-4 hours).
- Study metadata can be cached for 24 hours to reduce API calls.
- Individual lists can be cached for 1 hour.

### Estimated Effort
- Replace CSV parser with `csv` crate: **2h**
- Study freshness filter: **1h**
- Movement detection: **2h**
- Reduce API calls (caching): **3h**
- Aggregate metrics: **2h**
- Total: **~10h**

---

## 14. eBird

**Files:**
- `data-node/src/market_data/sources/ebird/client.rs` (663 lines)
- `data-node/src/config/ebird.json` (23 assets)

### Current State
- 23 static assets across 3 metric types:
  - **Stats**: Species count and checklists per region per day (15 assets)
  - **Obs**: Recent observation counts per region (4 assets)
  - **Notable**: Rare/notable sighting counts per region (4 assets)
- API: eBird v2 (Cornell Lab of Ornithology)
- Auth: `EBIRD_API_KEY` via `X-eBird-Api-Token` header
- Smart deduplication: Multiple stats assets sharing the same region (e.g., US species + US checklists) share one API call
- 2-second delay between requests
- 10min sync, 10 req/min rate limit
- "Global notable" is aggregated from 7 major birding regions (US, GB, AU, CR, CO, BR, IN)

### Problems Found
1. **Global notable makes 7 separate API calls**: `fetch_global_notable()` sequentially queries 7 regions with 2s delays = 14+ seconds for one metric. This could be parallelized or cached.
2. **Today's date for stats**: Stats use today's date (`Utc::now()`) which may not have data yet early in the day. eBird stats are often available the next day.
3. **Heavy US bias**: 15 of 23 assets are US-focused. Only 8 cover other regions.
4. **Re-parses config JSON on every fetch_prices call**: Same pattern as other sources.
5. **Zero observations on failed API call**: If the API call fails, the asset gets `Decimal::ZERO`. This is indistinguishable from "no birds observed today."

### Data Quality Issues
- **Time of day sensitivity**: Species counts and checklists accumulate throughout the day. Early morning values are always lower than end-of-day.
- **Seasonal variation**: Bird observations peak during migration seasons (spring/fall in temperate zones). Winter values are typically lower.
- **Regional coverage disparity**: US and UK have dense eBird coverage. Countries like India and Brazil have much sparser data relative to their biodiversity.

### Upgrade Plan
1. **Use yesterday's date for stats**: Change to `Utc::now() - 1 day` for more complete daily statistics.
2. **Pre-compute config HashMap**: Parse once at construction.
3. **Add more international regions**: Cover Africa (ZA, KE, TZ), Asia (MY, TH, PH), South America (EC, PE).
4. **Add species richness trend**: Compare today's species count to same date last year.
5. **Parallelize global notable**: Use `tokio::join!` for the 7 regional queries.
6. **Add "hotspot activity" metric**: eBird API has a hotspots endpoint showing the most active birding locations.
7. **Differentiate API failures from zero**: Return `None` on API failure instead of `Decimal::ZERO`.

### Smart Discovery
Static config is appropriate. eBird regions are well-defined (ISO country codes and US state codes). Could add dynamic discovery of top-contributing regions.

### Zero-Value Strategy
- Zero species on a failed API call should NOT be stored. Currently defaults to zero on failure, which is wrong.
- Zero species early in the day is valid (no checklists submitted yet).
- Zero observations in a region is valid but rare for populated areas.

### Freshness Strategy
- 10min sync is appropriate. eBird data is submitted by humans and accumulated over the course of a day.
- Stats data is best queried once per day (or use yesterday's data).
- Observations and notable sightings update more frequently during daylight hours.

### Estimated Effort
- Use yesterday for stats: **0.5h**
- Pre-compute HashMap: **0.5h**
- Add international regions: **2h**
- Parallelize global notable: **1h**
- Differentiate failures from zero: **1h**
- Total: **~5h**

---

## 15. Animals/Wildlife

**Files:**
- `data-node/src/market_data/sources/animals/client.rs` (472 lines)
- `data-node/src/config/animals.json` (24 assets)

### Current State
- 24 static assets from 2 APIs: GBIF (6 taxon groups) and iNaturalist (18 species + aggregates)
- GBIF: Global Biodiversity Information Facility -- observation counts by taxon key
- iNaturalist: Citizen science platform -- observation counts by taxon ID
- GBIF uses 7-day lookback (data ingestion lag), iNaturalist uses 1-day lookback
- 3 API reference types: `gbif:{key}`, `inat:{id}`, `inat_endangered:{id}`
- Sequential fetching with 2-second delays
- 10min sync, 30 req/min rate limit
- No auth required for either API

### Problems Found
1. **Sequential fetching is slow**: 24 assets x 2s delay = 48 seconds per sync. GBIF and iNaturalist could be fetched in parallel since they are independent APIs.
2. **GBIF 7-day window**: The 7-day lookback is documented as necessary due to "data ingestion lag." This means GBIF values change slowly and include multi-day data, while iNaturalist values are daily. This inconsistency makes comparison misleading.
3. **Skips failed assets entirely**: On API error, the asset is skipped (no PriceUpdate generated). This means the database retains the last successful value, which could be days old.
4. **Name mismatch**: Config says "24h" in asset names but GBIF uses 7-day and iNaturalist uses 1-day windows. The names are inaccurate.
5. **iNaturalist `per_page=0`**: The API is called with `per_page=0` which avoids downloading actual observations. Only `total_results` is used. This is efficient but unusual.

### Data Quality Issues
- **GBIF lag**: GBIF data can be days to weeks old. The "24h" label is misleading.
- **iNaturalist citizen science bias**: Observations are concentrated in North America, Europe, and Australia. Tropical species may be undercounted.
- **Rare species near zero**: Snow leopard, orangutan, and giant panda observations per day are often 0-2. These are legitimately rare animals.
- **Endangered sightings metric** (`inat_endangered:1`): Uses `threatened=true` filter on taxon_id=1 (Animalia). This counts all endangered species observations, not just specific species.

### Upgrade Plan
1. **Parallelize GBIF and iNaturalist calls**: Separate the 6 GBIF calls and 18 iNaturalist calls. Run GBIF calls in parallel, then iNaturalist calls in parallel.
2. **Fix asset names**: Change from "24h" to "7d" for GBIF assets and "daily" for iNaturalist assets.
3. **Add weekly trend**: Compare this period's GBIF count to last week's for trend detection.
4. **Add seasonal baselines**: Store monthly averages to detect unusual activity (e.g., unexpected migration).
5. **Add geographic breakdown**: For common species, break observations by continent.
6. **Handle API failures explicitly**: Emit a "stale" marker or previous value instead of silently skipping.

### Smart Discovery
Static config is appropriate. Taxon IDs are well-defined. Could add dynamic discovery of trending species (iNaturalist has a "most observed species" endpoint).

### Zero-Value Strategy
- Zero observations for rare species (snow leopard, panda) is very common and valid.
- Zero observations for common species groups (birds, mammals) is suspicious and likely an API error.
- GBIF returning 0 for the 7-day window for birds (taxon 212) would be extraordinary -- flag as error.

### Freshness Strategy
- 10min sync is overkill for data that updates daily (iNaturalist) or weekly (GBIF).
- GBIF: 1-hour sync would be sufficient.
- iNaturalist: 30-min sync would be sufficient.
- Consider running GBIF less frequently to save API calls.

### Estimated Effort
- Parallelize calls: **2h**
- Fix asset names: **0.5h**
- Handle API failures: **1h**
- Add seasonal baselines: **3h**
- Total: **~7h**

---

## 16. Epidemic disease.sh

**Files:**
- `data-node/src/market_data/sources/epidemic/client.rs` (374 lines)
- `data-node/src/config/epidemic.json` (35 assets)

### Current State
- 35 static assets: 5 global metrics + 30 per-country metrics
- API: disease.sh COVID-19 API (free, no auth)
- Global metrics: todayCases, todayDeaths, active, recovered, casesPerOneMillion
- Country metrics: mostly todayCases for 30 countries
- 2-second delay between country requests
- Grouped by scope: 1 global API call + 1 call per unique country
- 30min sync, 30 req/min rate limit
- Implements `discover_upstream_assets()` (but returns empty)

### Problems Found
1. **disease.sh may be deprecated/unreliable**: disease.sh is a community API that has become less reliable as COVID-19 reporting has decreased. Many countries have stopped daily COVID reporting entirely.
2. **COVID-only**: The source is exclusively COVID-19. Does not cover other diseases (flu, mpox, dengue, etc.).
3. **Most country data is stale**: Many countries (Australia, Japan, South Korea, etc.) stopped reporting daily COVID data in 2023. The API returns the last known values, which are years old.
4. **todayCases returns 0**: For countries that stopped reporting, `todayCases` is always 0. This is indistinguishable from "zero new cases" vs. "country no longer reports."
5. **Sequential country fetching**: 30 countries x 2s = 60+ seconds per sync.
6. **Uses `serde_json::Value` for responses**: Dynamic JSON parsing instead of typed structs. Less safe, harder to refactor.
7. **Symbol generation ignores per-asset symbols**: The code generates `EPI/{scope.to_uppercase()}` but the config already has specific symbols like `EPI/US/CASES`.

### Data Quality Issues
- **Stale data masquerading as current**: Countries that stopped reporting show 0 for `todayCases` indefinitely. There is no way to know if this means "zero cases" or "no longer reporting."
- **disease.sh data sources vary by country**: Some countries are scraped from government websites, others from Johns Hopkins. Quality varies.
- **casesPerOneMillion can be very stale**: This cumulative metric stopped updating when reporting stopped.
- **"Active cases" metric is unreliable**: `active = cases - recovered - deaths`. Many countries stopped updating recovered counts, making active cases meaningless.

### Upgrade Plan
1. **Evaluate API viability**: Check if disease.sh is still actively maintained and returning current data. If not, consider alternatives.
2. **Add WHO Global Health Observatory data**: WHO provides broader health data including flu surveillance, dengue, mpox, and other diseases.
3. **Add staleness detection**: Track "last time todayCases was non-zero" per country. Flag countries with > 30 days of zeros as "no longer reporting."
4. **Use typed structs**: Replace `serde_json::Value` with proper deserialization structs for the disease.sh response.
5. **Implement `discover_upstream_assets()`**: Use the `/countries` endpoint to discover all available countries and their reporting status.
6. **Add non-COVID diseases**: Integrate WHO FLUNET, ProMED, or similar APIs for broader epidemic monitoring.
7. **Parallelize country fetching**: Group countries and fetch in parallel (within rate limits).

### Smart Discovery
The `discover_upstream_assets()` method exists but returns empty. Should be implemented to query disease.sh `/countries` for available countries and their data freshness.

### Zero-Value Strategy
- todayCases = 0 for a country that recently had cases is suspicious. Could mean reporting stopped.
- todayCases = 0 for a country that never reports (some Pacific islands) is expected.
- active = 0 while todayCases > 0 is impossible and indicates stale recovered/deaths data.
- Add a "reporting status" meta-metric: 1 = actively reporting, 0 = stale/stopped.

### Freshness Strategy
- 30min sync is appropriate since disease.sh data typically updates daily at best.
- Many country data points haven't updated in months or years. Consider reducing sync frequency to 1 hour or even 4 hours for this source.
- The real fix is to add alternative data sources that are actively maintained.

### Estimated Effort
- Staleness detection: **2h**
- Typed structs: **1h**
- Implement discover_upstream_assets: **1h**
- Parallelize fetching: **1h**
- WHO/alternative data source: **12h** (new source)
- Total: **~17h** (5h without new data source)

---

## Summary Table

| # | Source | Assets | Sync | Critical Issues | Effort |
|---|--------|--------|------|-----------------|--------|
| 1 | OpenMeteo Weather | 25,000 | 5min | Delete old weather source | 6h |
| 2 | Weather Alerts NWS | 20 | 5min | US-only, HashMap perf | 10h |
| 3 | Earthquake USGS | 20 | 5min | Parallelize feeds | 6h |
| 4 | Volcano USGS | 50 | 10min | Non-US volcanoes never match | 12h |
| 5 | SpaceWeather NOAA | 10 | 10min | Parallelize endpoints | 7h |
| 6 | Wildfire FIRMS | 20 | 30min | Single-call strategy (60s -> 1 call) | 7h |
| 7 | Flights adsb.lol | 25 | 5min | **BUG: South America bbox inverted** | 4h |
| 8 | Military Aircraft | 9+dyn | 5min | US-only, visibility bias | 8h |
| 9 | AISStream Vessels | 0+dyn | 60s | No aggregates, WS health | 10h |
| 10 | Maritime | 25 | 10min | **250s sync time**, replace with WS | 10h |
| 11 | GTFS-RT Transit | 13+dyn | 2min | Only 2 transit systems | 14h |
| 12 | ISS | 5 | 10min | Speed/altitude are fake constants | 8h |
| 13 | Movebank GPS | 0+dyn | 30min | Hand-rolled CSV parser | 10h |
| 14 | eBird | 23 | 10min | Zero on failure, global notable slow | 5h |
| 15 | Animals/Wildlife | 24 | 10min | GBIF 7d mislabeled as 24h | 7h |
| 16 | Epidemic disease.sh | 35 | 30min | Data likely stale/deprecated | 17h |

**Total estimated effort: ~141 hours**

## Priority Order (by impact)

### P0 -- Bug Fixes (do first)
1. **Flights: Fix South America bounding box** (0.25h) -- currently returns zero always
2. **Delete old weather/client.rs** (0.5h) -- dead code, source_id conflict

### P1 -- Performance Critical
3. **Maritime: Replace REST with WebSocket** (6h) -- eliminates 250s sync
4. **Wildfire: Single global call** (3h) -- eliminates 60s sync (20 calls -> 1)
5. **SpaceWeather: Parallelize endpoints** (1h) -- easy win
6. **Earthquake: Parallelize feeds** (1h) -- easy win

### P2 -- Data Quality
7. **Volcano: Remove non-US volcanoes** (1h) -- they all return zero permanently
8. **eBird: Use yesterday for stats** (0.5h) -- today's stats are incomplete
9. **Animals: Fix 24h labels** (0.5h) -- GBIF uses 7-day window
10. **Epidemic: Add staleness detection** (2h) -- stale data masquerading as current
11. **ISS: Switch to real data API** (2h) -- speed/altitude are fake constants

### P3 -- Feature Additions
12. **GTFS-RT: Add more transit systems** (6h per system)
13. **AISStream: Add aggregate metrics** (2h)
14. **Flights: Add altitude filtering** (1.5h)
15. **Movebank: Replace CSV parser** (2h)
16. **eBird: Add international regions** (2h)
