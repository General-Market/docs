# 10 New "Bet on Everything" Data Sources — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 10 new data sources (volcano, earthquake, spaceweather, wildfire, flights, maritime, epidemic, sports, iss, weather_alerts) to the Index data-node, plus port the refresh-assets CLI for asset discovery.

**Architecture:** Each source follows the existing `MarketDataSource` trait pattern — a `client.rs` implementing the trait, a `mod.rs` re-exporting, and a seed JSON in `config/`. Sources are wired via `SyncEngine` in `main.rs`. The fourchan source is the template for no-auth, metric-based sources.

**Tech Stack:** Rust, async-trait, reqwest (via `SourceHttpClient`), serde, rust_decimal, chrono, sqlx (Postgres)

**Reference design:** `docs/plans/2026-02-22-new-data-sources-design.md`

---

## Phase 0: Asset Discovery Pipeline

### Task 0a: Add `refresh-assets` subcommand

**Files:**
- Modify: `data-node/src/config.rs` (add `RefreshAssets` variant + args struct)
- Create: `data-node/src/refresh_assets.rs` (port from AA)
- Modify: `data-node/src/main.rs` (add `Command::RefreshAssets` match arm)

**Step 1: Add CLI args to config.rs**

In `data-node/src/config.rs`, add the new subcommand variant and args:

```rust
// Add to Command enum:
    /// Discover upstream assets and merge into config JSON
    RefreshAssets(RefreshAssetsArgs),

// Add args struct after DlBackfillArgs:
#[derive(Parser, Debug)]
pub struct RefreshAssetsArgs {
    /// Source ID to refresh (e.g. "crypto", "volcano")
    #[arg(long)]
    pub source: String,

    /// Dry run — print changes without writing
    #[arg(long, default_value = "false")]
    pub dry_run: bool,

    /// Output file path (default: overwrites config/{source}.json)
    #[arg(long)]
    pub output: Option<String>,

    /// Log level
    #[arg(long, default_value = "info", env = "DATA_NODE_LOG_LEVEL")]
    pub log_level: String,
}
```

**Step 2: Create refresh_assets.rs**

Create `data-node/src/refresh_assets.rs` — ported from `AA/frontend/index-maker/prod/be_~/market-data-lib/src/bin/refresh_assets.rs`. Core logic:

```rust
//! Refresh-assets CLI: discovers upstream assets and merges into config JSON.
//!
//! Merge rules:
//! - New upstream assets → add as active
//! - Existing assets still upstream → keep as-is (don't touch active/inactive)
//! - Assets missing upstream → deactivate (never delete)
//! - Output sorted by asset_id for stable diffs

use anyhow::{Context, Result};
use std::collections::HashMap;
use tracing::info;

use crate::config::RefreshAssetsArgs;
use crate::market_data::traits::AssetEntry;

/// Run the refresh-assets subcommand
pub async fn run(args: RefreshAssetsArgs) -> Result<(), Box<dyn std::error::Error>> {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(&args.log_level));
    tracing_subscriber::fmt().with_env_filter(filter).init();

    info!("Refreshing assets for source: {}", args.source);

    // 1. Read existing config JSON from disk
    let config_path = args.output.clone().unwrap_or_else(|| {
        format!("data-node/src/config/{}.json", args.source)
    });
    let existing_json = std::fs::read_to_string(&config_path)
        .unwrap_or_else(|_| "[]".to_string());
    let existing: Vec<AssetEntry> = serde_json::from_str(&existing_json)
        .context("Failed to parse existing config JSON")?;

    // 2. Instantiate the source and call discover_upstream_assets()
    let source = create_source_for_refresh(&args.source)?;
    let upstream = source.discover_upstream_assets().await?;

    info!(
        "Found {} existing assets, {} upstream assets",
        existing.len(),
        upstream.len()
    );

    // 3. Merge
    let merged = merge_assets(existing, upstream);

    info!("Merged result: {} total assets", merged.len());

    // 4. Serialize sorted
    let json = serde_json::to_string_pretty(&merged)?;

    if args.dry_run {
        println!("{}", json);
        info!("Dry run — no files written");
    } else {
        std::fs::write(&config_path, &json)
            .context(format!("Failed to write {}", config_path))?;
        info!("Wrote {} assets to {}", merged.len(), config_path);
    }

    Ok(())
}

/// Merge existing config with upstream discovered assets.
/// Rules: new → add active, missing upstream → deactivate, never delete.
fn merge_assets(existing: Vec<AssetEntry>, upstream: Vec<AssetEntry>) -> Vec<AssetEntry> {
    let upstream_map: HashMap<String, AssetEntry> = upstream
        .into_iter()
        .map(|a| (a.asset_id.clone(), a))
        .collect();

    let mut result_map: HashMap<String, AssetEntry> = HashMap::new();

    // Keep all existing entries, deactivating those missing upstream
    for mut entry in existing {
        if !upstream_map.contains_key(&entry.asset_id) {
            entry.active = false; // deactivate missing
        }
        result_map.insert(entry.asset_id.clone(), entry);
    }

    // Add new upstream entries not in existing
    for (id, entry) in upstream_map {
        if !result_map.contains_key(&id) {
            result_map.insert(id, entry);
        }
    }

    // Sort by asset_id for stable diffs
    let mut result: Vec<AssetEntry> = result_map.into_values().collect();
    result.sort_by(|a, b| a.asset_id.cmp(&b.asset_id));
    result
}

/// Create a MarketDataSource instance for the given source_id.
/// Only sources that implement discover_upstream_assets() are supported.
fn create_source_for_refresh(source_id: &str) -> Result<Box<dyn crate::market_data::traits::MarketDataSource>> {
    use crate::market_data::sources::*;
    match source_id {
        "crypto" => Ok(Box::new(CoinGeckoMarketSource::from_env()?)),
        "defi" => Ok(Box::new(DefiLlamaMarketSource::from_env()?)),
        "polymarket" => Ok(Box::new(PolymarketMarketSource::from_env()?)),
        "steam" => Ok(Box::new(SteamMarketSource::from_env()?)),
        "npm" => Ok(Box::new(NpmMarketSource::from_env()?)),
        "pypi" => Ok(Box::new(PypiMarketSource::from_env()?)),
        "crates_io" => Ok(Box::new(CratesIoMarketSource::from_env()?)),
        "github" => Ok(Box::new(GithubMarketSource::from_env()?)),
        "twitch" => Ok(Box::new(TwitchMarketSource::from_env()?)),
        "twse" => Ok(Box::new(TwseMarketSource::from_env()?)),
        "anilist" => Ok(Box::new(AniListMarketSource::from_env()?)),
        "cloudflare" => Ok(Box::new(CloudflareRadarMarketSource::from_env()?)),
        "backpacktf" => Ok(Box::new(BackpackTfMarketSource::from_env()?)),
        "tmdb" => Ok(Box::new(TmdbMarketSource::from_env()?)),
        // New sources with discovery:
        "volcano" => Ok(Box::new(VolcanoMarketSource::from_env()?)),
        "maritime" => Ok(Box::new(MaritimeMarketSource::from_env()?)),
        "epidemic" => Ok(Box::new(EpidemicMarketSource::from_env()?)),
        "sports" => Ok(Box::new(SportsMarketSource::from_env()?)),
        _ => anyhow::bail!("Source '{}' does not support asset discovery", source_id),
    }
}
```

**Step 3: Wire in main.rs**

Add to the `match cli.command` block in `main.rs`:

```rust
Command::RefreshAssets(args) => refresh_assets::run(args).await,
```

And add `mod refresh_assets;` at the top.

**Step 4: Verify**

Run: `cargo check -p data-node`
Expected: Compiles (note: VolcanoMarketSource etc. won't exist yet — add `#[allow(unused)]` or implement sources first)

**Step 5: Commit**

```bash
git add data-node/src/config.rs data-node/src/refresh_assets.rs data-node/src/main.rs
git commit -m "feat: add refresh-assets subcommand for asset discovery pipeline"
```

---

## Phase 1: New Data Sources (10 sources)

Each source follows the exact same pattern. Template from `fourchan/client.rs`:
1. Create `data-node/src/market_data/sources/{name}/mod.rs`
2. Create `data-node/src/market_data/sources/{name}/client.rs`
3. Create `data-node/src/config/{name}.json` (seed assets or `[]`)
4. Add `pub mod {name};` + re-export to `sources/mod.rs`
5. Add spawn block in `main.rs`
6. Add entry to `SOURCE_META` in `api.rs`
7. Add new category constants to `traits.rs` if needed

### New categories needed

Before implementing sources, add these categories to `traits.rs`:

```rust
// In pub mod categories:
pub const GEOPHYSICAL: &str = "geophysical";   // volcano, earthquake
pub const SPACE: &str = "space";               // spaceweather, iss
pub const ENVIRONMENT: &str = "environment";   // wildfire, weather_alerts
pub const TRANSPORT: &str = "transport";       // flights, maritime
pub const HEALTH: &str = "health";             // epidemic
pub const SPORTS: &str = "sports";             // sports

// Update ALL array:
pub const ALL: &[&str] = &[
    STOCKS, CRYPTO, DEFI, MACRO, COMMODITIES, WEATHER, ONCHAIN, SENTIMENT,
    REGULATORY, GEOPHYSICAL, SPACE, ENVIRONMENT, TRANSPORT, HEALTH, SPORTS,
];
```

**Commit:** `feat: add new asset categories for bet-on-everything sources`

---

### Task 1: USGS Volcanoes (`volcano`)

**Files:**
- Create: `data-node/src/market_data/sources/volcano/mod.rs`
- Create: `data-node/src/market_data/sources/volcano/client.rs`
- Create: `data-node/src/config/volcano.json`
- Modify: `data-node/src/market_data/sources/mod.rs`
- Modify: `data-node/src/main.rs`
- Modify: `data-node/src/api.rs` (SOURCE_META)

**Step 1: Create config/volcano.json**

Seed with top 50 volcanoes. Each entry:

```json
[
  {
    "asset_id": "volcano_kilauea",
    "symbol": "VOLC/KILAUEA",
    "name": "Kilauea (Hawaii, USA)",
    "category": "geophysical",
    "subcategory": "volcano",
    "api_ref": "kilauea",
    "active": true
  },
  {
    "asset_id": "volcano_etna",
    "symbol": "VOLC/ETNA",
    "name": "Mount Etna (Sicily, Italy)",
    "category": "geophysical",
    "subcategory": "volcano",
    "api_ref": "etna",
    "active": true
  }
]
```

Include ~50 entries: Kilauea, Mauna Loa, St Helens, Rainier, Etna, Vesuvius, Stromboli, Fuji, Pinatubo, Taal, Merapi, Krakatau, Ruapehu, Tongariro, Popocatépetl, Colima, Cotopaxi, Tungurahua, Villarrica, Llaima, Eyjafjallajökull, Hekla, Katla, Grímsvötn, Bárðarbunga, Fagradalsfjall, Erebus, Nyiragongo, Nyamuragira, Ol Doinyo Lengai, Piton de la Fournaise, Sakurajima, Aso, Shinmoedake, Suwanosejima, Semeru, Sinabung, Agung, Rinjani, Mayon, Klyuchevskoy, Shiveluch, Bezymianny, Karymsky, Pavlof, Cleveland, Shishaldin, Great Sitkin, Bogoslof, Yellowstone.

**Step 2: Create volcano/mod.rs**

```rust
pub mod client;
pub use client::VolcanoMarketSource;
```

**Step 3: Create volcano/client.rs**

```rust
//! USGS Volcano monitoring implementing MarketDataSource
//!
//! Tracks volcano alert levels from USGS Volcano Hazards Program.
//! API: https://volcanoes.usgs.gov/vsc/api/volcanoApi/
//! Auth: None
//! Rate limit: ~60 req/min (generous, government API)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::time::Duration;
use tracing::{info, warn};

use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

const ASSET_JSON: &str = include_str!("../../../config/volcano.json");
const API_BASE: &str = "https://volcanoes.usgs.gov/vsc/api/volcanoApi";

/// Alert level numeric mapping: Normal=0, Advisory=1, Watch=2, Warning=3
fn alert_to_numeric(alert: &str) -> Decimal {
    match alert.to_lowercase().as_str() {
        "normal" => Decimal::ZERO,
        "advisory" => Decimal::ONE,
        "watch" => Decimal::from(2),
        "warning" => Decimal::from(3),
        _ => Decimal::ZERO,
    }
}

/// Color code numeric mapping: Green=0, Yellow=1, Orange=2, Red=3
fn color_to_numeric(color: &str) -> Decimal {
    match color.to_lowercase().as_str() {
        "green" => Decimal::ZERO,
        "yellow" => Decimal::ONE,
        "orange" => Decimal::from(2),
        "red" => Decimal::from(3),
        _ => Decimal::ZERO,
    }
}

#[derive(Debug, Deserialize)]
struct VolcanoElevated {
    #[serde(rename = "vName")]
    name: Option<String>,
    #[serde(rename = "vAlertLevel")]
    alert_level: Option<String>,
    #[serde(rename = "vColorCode")]
    color_code: Option<String>,
}

pub struct VolcanoMarketSource {
    http: SourceHttpClient,
}

impl VolcanoMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Volcano source initialized");
        Ok(Self { http })
    }

    async fn fetch_elevated(&self) -> Result<Vec<VolcanoElevated>, SourceError> {
        let url = format!("{}/elevated", API_BASE);
        self.http.get_json::<Vec<VolcanoElevated>>(&url).await
    }
}

#[async_trait::async_trait]
impl MarketDataSource for VolcanoMarketSource {
    fn source_id(&self) -> &'static str { "volcano" }
    fn display_name(&self) -> &'static str { "USGS Volcanoes" }
    fn default_resolution(&self) -> &'static str { "deterministic" }
    fn sync_interval(&self) -> Duration { Duration::from_secs(600) }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Fetch elevated volcanoes (those with above-normal alert levels)
        let elevated = match self.fetch_elevated().await {
            Ok(v) => v,
            Err(e) => {
                warn!("Failed to fetch elevated volcanoes: {:?}", e);
                Vec::new()
            }
        };

        // Build a map of volcano_name -> (alert_level, color_code)
        let mut elevated_map = std::collections::HashMap::new();
        for v in &elevated {
            if let Some(name) = &v.name {
                let key = name.to_lowercase().replace(' ', "_").replace('-', "_");
                elevated_map.insert(key, v);
            }
        }

        for asset_id in asset_ids {
            let volcano_key = asset_id.strip_prefix("volcano_").unwrap_or(asset_id);

            // Check if this volcano is in the elevated list
            // Value = alert level numeric (0-3). Default 0 (Normal) if not elevated.
            let value = if let Some(v) = elevated_map.get(volcano_key) {
                alert_to_numeric(v.alert_level.as_deref().unwrap_or("normal"))
            } else {
                Decimal::ZERO // Normal
            };

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: format!("VOLC/{}", volcano_key.to_uppercase()),
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!("Fetched {}/{} volcano alert levels", results.len(), asset_ids.len());
        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        // Fetch the full GVP catalog for discovery
        let url = format!("{}/volcanoesGVP", API_BASE);
        // Return empty for now — implement when discovery pipeline is wired
        Ok(vec![])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_config_loads() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.len() >= 40, "Expected at least 40 volcanoes, got {}", entries.len());
    }

    #[test]
    fn test_alert_mapping() {
        assert_eq!(alert_to_numeric("Normal"), Decimal::ZERO);
        assert_eq!(alert_to_numeric("Advisory"), Decimal::ONE);
        assert_eq!(alert_to_numeric("Watch"), Decimal::from(2));
        assert_eq!(alert_to_numeric("Warning"), Decimal::from(3));
    }

    #[test]
    fn test_color_mapping() {
        assert_eq!(color_to_numeric("Green"), Decimal::ZERO);
        assert_eq!(color_to_numeric("Red"), Decimal::from(3));
    }
}
```

**Step 4: Add to sources/mod.rs**

```rust
pub mod volcano;
// and in re-exports:
pub use volcano::VolcanoMarketSource;
```

**Step 5: Add spawn block in main.rs**

```rust
// Volcano — USGS (no key needed)
{
    let pool_c = pool.clone();
    tokio::spawn(async move {
        match market_data::sources::volcano::VolcanoMarketSource::from_env() {
            Ok(source) => {
                let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                engine.run().await;
            }
            Err(e) => tracing::error!("Volcano init failed: {e}"),
        }
    });
}
```

**Step 6: Add to SOURCE_META in api.rs**

```rust
("volcano", "USGS Volcanoes", 600),
```

**Step 7: Verify and commit**

```bash
cargo check -p data-node
git add data-node/src/market_data/sources/volcano/ data-node/src/config/volcano.json \
    data-node/src/market_data/sources/mod.rs data-node/src/main.rs data-node/src/api.rs
git commit -m "feat: add USGS volcano monitoring data source"
```

---

### Task 2: USGS Earthquakes (`earthquake`)

**Files:**
- Create: `data-node/src/market_data/sources/earthquake/mod.rs`
- Create: `data-node/src/market_data/sources/earthquake/client.rs`
- Create: `data-node/src/config/earthquake.json`
- Modify: `sources/mod.rs`, `main.rs`, `api.rs`

**API:** `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson`

**Assets (static, ~10):**
- `eq_count_m25_1h` — M2.5+ quakes in last hour
- `eq_count_m45_24h` — M4.5+ quakes in last 24h
- `eq_max_mag_24h` — Largest quake magnitude in 24h
- `eq_count_all_1h` — All quakes in last hour
- `eq_significant_month` — Significant quakes this month
- `eq_ring_of_fire_24h` — Ring of Fire quakes in 24h (lat/lon filter)
- `eq_mediterranean_24h` — Mediterranean quakes in 24h
- `eq_us_west_24h` — US West Coast quakes in 24h
- `eq_japan_24h` — Japan region quakes in 24h
- `eq_total_energy_24h` — Total seismic energy (sum of 10^(1.5*mag))

**Key implementation notes:**
- GeoJSON response: `features[].properties.mag`, `features[].properties.time`, `features[].geometry.coordinates`
- Use `all_hour.geojson` for hourly metrics, `4.5_day.geojson` for daily M4.5+, `significant_month.geojson` for monthly
- Region filtering by bounding box on `geometry.coordinates[0]` (lon) and `[1]` (lat)
- Poll: 5 min

**Config:** Static JSON with 10 asset entries.

**Commit:** `feat: add USGS earthquake monitoring data source`

---

### Task 3: NOAA Space Weather (`spaceweather`)

**Files:** Same pattern as above.

**API:** `https://services.swpc.noaa.gov/products/`
- `noaa-planetary-k-index.json` — Kp index (geomagnetic)
- `solar-wind/plasma-7-day.json` — solar wind speed/density
- `noaa-scales.json` — G/S/R scale alerts

**Assets (static, ~10):**
- `sw_kp_index` — Current Kp index (0-9 scale)
- `sw_solar_wind_speed` — Solar wind speed (km/s)
- `sw_solar_wind_density` — Solar wind density (p/cm³)
- `sw_xray_flux` — X-ray flux level
- `sw_proton_flux` — Proton flux level
- `sw_g_scale` — Geomagnetic storm scale (G0-G5 → 0-5)
- `sw_s_scale` — Solar radiation storm scale (S0-S5 → 0-5)
- `sw_r_scale` — Radio blackout scale (R0-R5 → 0-5)
- `sw_sunspot_number` — Daily sunspot number
- `sw_flare_count_24h` — Solar flares in last 24h

**Key notes:**
- NOAA JSON responses are arrays of arrays (not objects). First row is headers.
- Kp index: `[[time_tag, Kp, ...], ...]` — take last entry
- Solar wind: `[[time_tag, density, speed, temperature], ...]`
- Poll: 10 min
- Category: `space`

**Commit:** `feat: add NOAA space weather data source`

---

### Task 4: NASA FIRMS Wildfires (`wildfire`)

**Files:** Same pattern.

**API:** `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/VIIRS_SNPP_NRT/{region}/1`

**Auth:** Requires `NASA_FIRMS_MAP_KEY` env var (free registration). Gated in main.rs.

**Assets (static, ~20 regions):**

```json
[
  {"asset_id": "fire_us_west", "symbol": "FIRE/US_WEST", "name": "US West Coast Fires", "api_ref": "-125,32,-104,49"},
  {"asset_id": "fire_us_east", "symbol": "FIRE/US_EAST", "name": "US East Coast Fires", "api_ref": "-104,25,-67,49"},
  {"asset_id": "fire_amazon", "symbol": "FIRE/AMAZON", "name": "Amazon Basin Fires", "api_ref": "-75,-20,-44,5"},
  {"asset_id": "fire_australia", "symbol": "FIRE/AUSTRALIA", "name": "Australia Fires", "api_ref": "113,-44,154,-10"},
  {"asset_id": "fire_siberia", "symbol": "FIRE/SIBERIA", "name": "Siberia Fires", "api_ref": "60,50,180,75"},
  {"asset_id": "fire_central_africa", "symbol": "FIRE/C_AFRICA", "name": "Central Africa Fires", "api_ref": "8,-15,35,15"},
  {"asset_id": "fire_se_asia", "symbol": "FIRE/SE_ASIA", "name": "Southeast Asia Fires", "api_ref": "95,-10,140,25"},
  {"asset_id": "fire_mediterranean", "symbol": "FIRE/MEDITERRANEAN", "name": "Mediterranean Fires", "api_ref": "-10,30,40,47"}
]
```

Each region's `api_ref` is a bounding box `lon_min,lat_min,lon_max,lat_max`.

**Key notes:**
- CSV response: parse lines, count rows = hotspot count per region
- Value = number of active fire hotspots in the region
- Poll: 30 min
- CLI arg: `--nasa-firms-key` → `NASA_FIRMS_MAP_KEY`
- Category: `environment`

**Config:** `data-node/src/config.rs` needs new arg:
```rust
/// NASA FIRMS MAP key (enables wildfire hotspot tracking)
#[arg(long, env = "NASA_FIRMS_MAP_KEY")]
pub nasa_firms_key: Option<String>,
```

**Commit:** `feat: add NASA FIRMS wildfire hotspot data source`

---

### Task 5: OpenSky Flight Tracking (`flights`)

**Files:** Same pattern.

**API:** `https://opensky-network.org/api/states/all?lamin={}&lamax={}&lomin={}&lomax={}`

**Assets (static, ~30):**

Bounding boxes for major air traffic regions and airports. Value = airborne aircraft count.

```json
[
  {"asset_id": "flight_us", "api_ref": "24.5,49.5,-125,-66.5"},
  {"asset_id": "flight_europe", "api_ref": "35,72,-12,45"},
  {"asset_id": "flight_asia_pacific", "api_ref": "-10,60,60,180"},
  {"asset_id": "flight_jfk", "api_ref": "40.4,40.8,-74,-73.5"},
  {"asset_id": "flight_heathrow", "api_ref": "51.3,51.6,-0.7,-0.2"}
]
```

**Key notes:**
- Response: `{"states": [[icao24, callsign, origin_country, ...], ...]}` — count array length
- Rate limit: Anonymous 10s cooldown. Use 10 req/min to be safe.
- Poll: 10 min
- Category: `transport`
- No auth, but OpenSky can rate-limit aggressively. Use conservative rate limiting.

**Commit:** `feat: add OpenSky flight tracking data source`

---

### Task 6: AIS Maritime Vessels (`maritime`)

**Files:** Same pattern.

**API:** `https://aisstream.io/` REST API

**Auth:** Requires `AISSTREAM_API_KEY` env var (free registration). Gated in main.rs.

**Assets (static, ~30 ports/lanes):**

```json
[
  {"asset_id": "port_singapore", "api_ref": "103.5,1.1,104.1,1.5"},
  {"asset_id": "port_rotterdam", "api_ref": "3.8,51.8,4.5,52.1"},
  {"asset_id": "port_shanghai", "api_ref": "121.3,30.9,122,31.6"},
  {"asset_id": "lane_suez", "api_ref": "32.2,29.8,32.6,31.3"},
  {"asset_id": "lane_panama", "api_ref": "-80,-9.5,-79.3,9.5"}
]
```

**Key notes:**
- REST endpoint: query by bounding box, count vessel positions
- Value = vessel count in region
- Poll: 10 min
- Category: `transport`
- CLI arg: `--aisstream-api-key` → `AISSTREAM_API_KEY`

**Config.rs new arg:**
```rust
/// AIS Stream API key (enables maritime vessel tracking)
#[arg(long, env = "AISSTREAM_API_KEY")]
pub aisstream_api_key: Option<String>,
```

**Commit:** `feat: add AIS maritime vessel tracking data source`

---

### Task 7: disease.sh Epidemics (`epidemic`)

**Files:** Same pattern.

**API:** `https://disease.sh/v3/covid-19/`
- `/all` — global totals
- `/countries` — per-country data

**Assets (~35):** Top 30 countries + global aggregate + flu metrics.

```json
[
  {"asset_id": "epi_global_cases", "api_ref": "global:todayCases"},
  {"asset_id": "epi_global_deaths", "api_ref": "global:todayDeaths"},
  {"asset_id": "epi_global_active", "api_ref": "global:active"},
  {"asset_id": "epi_us_cases", "api_ref": "USA:todayCases"},
  {"asset_id": "epi_india_cases", "api_ref": "India:todayCases"},
  {"asset_id": "epi_brazil_cases", "api_ref": "Brazil:todayCases"}
]
```

**Key notes:**
- Parse `api_ref` as `country:metric` — route to `/all` for global, `/countries/{name}` per country
- Metrics: `todayCases`, `todayDeaths`, `active`, `casesPerOneMillion`, `testsPerOneMillion`
- No auth, generous rate limits
- Poll: 30 min
- Category: `health`
- Implements `discover_upstream_assets()` from `/countries` list

**Commit:** `feat: add disease.sh epidemic tracking data source`

---

### Task 8: ESPN Live Scores (`sports`)

**Files:** Same pattern.

**API:** `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard`

**Assets (~100 teams across 5 leagues):**

```json
[
  {"asset_id": "nba_lakers", "api_ref": "basketball/nba:13"},
  {"asset_id": "nba_celtics", "api_ref": "basketball/nba:2"},
  {"asset_id": "nfl_chiefs", "api_ref": "football/nfl:12"},
  {"asset_id": "mlb_yankees", "api_ref": "baseball/mlb:10"},
  {"asset_id": "nhl_rangers", "api_ref": "hockey/nhl:14"},
  {"asset_id": "epl_arsenal", "api_ref": "soccer/eng.1:359"}
]
```

**Key notes:**
- `api_ref` format: `{sport}/{league}:{team_id}`
- Value = team's latest score in current/last game. If no active game, use season wins.
- Group requests by league — one scoreboard fetch per league covers all teams
- Response: `events[].competitions[].competitors[]` has `id`, `score`, `winner`
- No auth, undocumented but widely used public API
- Poll: 1 min during live games (detect from response), 10 min otherwise
- Category: `sports`
- Implements `discover_upstream_assets()` from team lists

**Commit:** `feat: add ESPN live scores data source`

---

### Task 9: ISS Position (`iss`)

**Files:** Same pattern.

**API:**
- `http://api.open-notify.org/iss-now.json` — current position
- `http://api.open-notify.org/astros.json` — people in space

**Assets (static, 5):**

```json
[
  {"asset_id": "iss_latitude", "symbol": "ISS/LAT", "name": "ISS Latitude", "api_ref": "latitude"},
  {"asset_id": "iss_longitude", "symbol": "ISS/LON", "name": "ISS Longitude", "api_ref": "longitude"},
  {"asset_id": "iss_speed", "symbol": "ISS/SPEED", "name": "ISS Ground Speed (km/h)", "api_ref": "speed"},
  {"asset_id": "iss_altitude", "symbol": "ISS/ALT", "name": "ISS Altitude (km)", "api_ref": "altitude"},
  {"asset_id": "people_in_space", "symbol": "ISS/PEOPLE", "name": "People in Space", "api_ref": "people"}
]
```

**Key notes:**
- `/iss-now.json` returns `{"iss_position": {"latitude": "x", "longitude": "y"}, "timestamp": n}`
- Speed and altitude: derive from ISS orbital mechanics (~28,000 km/h, ~408 km) or use approximate constants
- `/astros.json` returns `{"number": n, "people": [...]}`
- No auth, simple API
- Poll: 10 min
- Category: `space`

**Commit:** `feat: add ISS position tracking data source`

---

### Task 10: NWS Severe Weather Alerts (`weather_alerts`)

**Files:** Same pattern.

**API:** `https://api.weather.gov/alerts/active?status=actual&message_type=alert`

**Assets (static, ~15 alert types):**

```json
[
  {"asset_id": "nws_tornado_warning", "symbol": "NWS/TORNADO", "name": "Active Tornado Warnings", "api_ref": "Tornado Warning"},
  {"asset_id": "nws_hurricane_warning", "symbol": "NWS/HURRICANE", "name": "Active Hurricane Warnings", "api_ref": "Hurricane Warning"},
  {"asset_id": "nws_flood_warning", "symbol": "NWS/FLOOD", "name": "Active Flood Warnings", "api_ref": "Flood Warning"},
  {"asset_id": "nws_blizzard_warning", "symbol": "NWS/BLIZZARD", "name": "Active Blizzard Warnings", "api_ref": "Blizzard Warning"},
  {"asset_id": "nws_severe_thunderstorm", "symbol": "NWS/TSTORM", "name": "Active Severe Thunderstorm Warnings", "api_ref": "Severe Thunderstorm Warning"},
  {"asset_id": "nws_winter_storm", "symbol": "NWS/WINTER", "name": "Active Winter Storm Warnings", "api_ref": "Winter Storm Warning"},
  {"asset_id": "nws_extreme_heat", "symbol": "NWS/HEAT", "name": "Active Extreme Heat Warnings", "api_ref": "Excessive Heat Warning"},
  {"asset_id": "nws_fire_weather", "symbol": "NWS/FIRE", "name": "Active Fire Weather Warnings", "api_ref": "Fire Weather Watch"},
  {"asset_id": "nws_tsunami", "symbol": "NWS/TSUNAMI", "name": "Active Tsunami Warnings", "api_ref": "Tsunami Warning"},
  {"asset_id": "nws_total_active", "symbol": "NWS/TOTAL", "name": "Total Active Weather Alerts", "api_ref": "_total"},
  {"asset_id": "nws_max_severity", "symbol": "NWS/SEVERITY", "name": "Maximum Alert Severity", "api_ref": "_max_severity"}
]
```

**Key notes:**
- Response: GeoJSON features, each with `properties.event`, `properties.severity`, `properties.urgency`
- Value = count of active alerts matching the `api_ref` event type
- `_total` = total count of all alerts
- `_max_severity` = numeric max (Minor=1, Moderate=2, Severe=3, Extreme=4)
- Requires `User-Agent` header (NWS requires it, no key)
- Poll: 5 min
- Category: `environment`
- Fundamentally different from Open-Meteo (forecasts vs. discrete warning events)

**Commit:** `feat: add NWS severe weather alerts data source`

---

## Phase 2: Wiring & Verification

### Task 11: Wire all 10 sources in main.rs + api.rs

After all 10 sources are built:

**main.rs spawn blocks:** Add all 10 (grouped after existing no-key sources):

No-key (always-on): `volcano`, `earthquake`, `spaceweather`, `flights`, `iss`, `weather_alerts`, `epidemic`, `sports`

Key-gated:
- `wildfire` → gated on `args.nasa_firms_key`
- `maritime` → gated on `args.aisstream_api_key`

**api.rs SOURCE_META additions:**

```rust
// ── Bet on Everything sources (10) ────────────────────────────────────
("volcano", "USGS Volcanoes", 600),
("earthquake", "USGS Earthquakes", 300),
("spaceweather", "NOAA Space Weather", 600),
("wildfire", "NASA FIRMS Wildfires", 1800),
("flights", "OpenSky Flights", 600),
("maritime", "AIS Maritime", 600),
("epidemic", "disease.sh Epidemics", 1800),
("sports", "ESPN Live Scores", 60),
("iss", "ISS Position", 600),
("weather_alerts", "NWS Severe Weather", 300),
```

**Commit:** `feat: wire all 10 new data sources into sync engine`

---

### Task 12: Cargo check + test

**Step 1:** `cargo check -p data-node` — must compile with 0 errors

**Step 2:** `cargo test -p data-node` — all existing + new unit tests pass

**Step 3:** Grep all `source_id()` values and verify they match SOURCE_META:

```bash
grep -r 'fn source_id' data-node/src/market_data/sources/*/client.rs | sort
```

Compare with SOURCE_META entries.

**Step 4:** Verify total source count: should be **46 SOURCE_META entries** (36 existing + 10 new)

**Commit:** `test: verify all 46 data sources compile and pass unit tests`

---

## Execution Order

**Parallel batch 1** (independent sources, 3 agents max):
- Agent A: Tasks 1-3 (volcano, earthquake, spaceweather) + categories update
- Agent B: Tasks 4-6 (wildfire, flights, maritime) + config.rs args
- Agent C: Tasks 7-9 (epidemic, sports, iss)

**Parallel batch 2** (remaining + wiring):
- Agent A: Task 10 (weather_alerts)
- Agent B: Task 0a (refresh-assets CLI)

**Sequential:**
- Task 11: Wire all 10 + api.rs updates
- Task 12: Cargo check + full test suite
