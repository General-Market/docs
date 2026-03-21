# Data Sources

All market data sources powering Vision. 94 source implementations across 90 modules, organized by update frequency.

**Last updated:** 2026-03-21

## Real-Time (< 5 min)

| Source | ID | Update | Auth | Notes |
|--------|----|--------|------|-------|
| AIS Ship Tracking | `aisstream` | 1 min (WebSocket) | `AISSTREAM_API_KEY` | Live vessel positions |
| Twitch | `twitch` | 1 min | `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` | Viewer counts |
| Sports | `sports` | 2 min | None | Live scores (TheSportsDB) |
| GTFS Real-Time | `gtfs_transit` | 2 min | None | Transit delays (static feed URLs). Dir: `gtfs_rt` |
| DefiLlama | `defi` | 2 min | None | TVL data. Polls frequently, upstream updates hourly. Dir: `defillama` |
| DB Trains | `db_trains` | 5 min | None | Deutsche Bahn delays (IRIS-TTS) |
| Earthquake | `earthquake` | 5 min | None | USGS seismic data |
| ISS Tracker | `iss` | 5 min | None | Space station position |
| PumpFun | `pumpfun` | 5 min | None | Solana token launches |
| Polymarket | `polymarket` | 5 min | None | Prediction market prices |
| CityBikes | `citybikes` | 5 min | None | Bike-share availability |
| MTA Subway | `mta_subway` | 5 min | None | NYC subway delays |
| Paris Metro | `paris_metro` | 5 min | None | RATP metro status |
| TfL Tube | `tfl_tube` | 5 min | None | London Underground status |
| Lichess | `lichess` | 5 min | None | Online chess players |
| HackerNews | `hackernews` | 5 min | None | Story scores |
| Weather Alerts | `weather_alerts` | 5 min | None | NWS alerts |
| Flights | `flights` | 5 min | None | FlightAware stats |
| Mil Aircraft | `mil_aircraft` | 5 min | `ADSBX_API_KEY` | Military aircraft tracking |
| TMDB | `tmdb` | 5 min | `TMDB_API_KEY` | Movie popularity |
| PandaScore | `esports` | 5 min | `PANDASCORE_API_KEY` | Esports match data. Dir: `pandascore` |
| Finnhub | `stocks` | 5 sec | `FINNHUB_API_KEY` | US stock prices. High-frequency ticker polling. Dir: `finnhub` |
| Open-Meteo (weather) | `weather` | 5 min | None | Global weather forecasts. Dir: `openmeteo` |

## Standard (5–15 min)

| Source | ID | Update | Auth | Notes |
|--------|----|--------|------|-------|
| CoinGecko | `crypto` | 10 min | `COINGECKO_API_KEY` (optional) | Crypto prices. Dir: `coingecko` |
| AniList | `anilist` | 10 min | None | Anime/manga popularity |
| Steam | `steam` | 10 min | None | Game player counts |
| Backpack.tf | `backpacktf` | 10 min | None | TF2 item prices |
| Crates.io | `crates_io` | 10 min | None | Rust crate downloads |
| 4chan | `fourchan` | 10 min | None | Thread activity |
| Chaturbate | `chaturbate` | 10 min | None | Viewer counts |
| GitHub | `github` | 10 min | `GITHUB_TOKEN` (optional) | Repo star counts |
| Last.fm | `lastfm` | 10 min | `LASTFM_API_KEY` | Artist listeners |
| Cloudflare Radar | `cloudflare` | 10 min | `CF_API_TOKEN` | Domain rankings |
| Volcano | `volcano` | 10 min | None | Smithsonian eruption alerts |
| SpaceWeather | `spaceweather` | 10 min | None | Solar activity (NOAA SWPC) |
| Maritime | `maritime` | 10 min | None | Digitraffic vessel data |
| Animals | `animals` | 10 min | None | Wildlife sighting data |
| AirNow | `airnow` | 10 min | `AIRNOW_API_KEY` | Air quality index |
| CrossRef | `crossref` | 10 min | None | Academic DOI registrations |
| OpenAlex | `openalex` | 10 min | None | Research paper metrics |
| PubMed | `pubmed` | 10 min | None | Medical paper counts |
| StackExchange | `stackexchange` | 10 min | `STACKEXCHANGE_KEY` | Q&A activity |
| CourtListener | `courtlistener` | 10 min | `COURTLISTENER_API_KEY` | Court case filings |
| NYC 311 | `nyc311` | 10 min | None | NYC complaints |
| McBroken | `mcbroken` | 10 min | None | McDonald's ice cream machine status |
| USGS Water | `usgs_water` | 10 min | None | River gauge data |
| NDBC | `ndbc` | 10 min | None | Marine buoy data |
| NOAA Met | `noaa_met` | 10 min | None | Weather observations |
| NWPS | `nwps` | 10 min | None | River gauge heights |
| Parking | `parking` | 10 min | None | City parking availability |
| FAA Delays | `faa_delays` | 10 min | None | US airport delays |
| Queue Times | `queue_times` | 10 min | None | Theme park wait times |
| Power Outages | `power_outages` | 10 min | None | US power outage counts |
| TomTom Traffic | `tomtom_traffic` | 10 min | `TOMTOM_API_KEY` | Traffic congestion |
| TomTom EV Charge | `tomtom_evcharge` | 10 min | `TOMTOM_API_KEY` | EV charger availability |
| Best Buy | `bestbuy` | 10 min | `BESTBUY_API_KEY` | Product prices |
| IODA | `ioda` | 10 min | None | Internet outage connectivity scores |
| TWSE | `twse` | 10 min | None | Taiwan stock exchange |
| BoardGameGeek | `bgg` | 10 min | None | Board game hotness rankings |
| Yahoo Drinks | `yahoo_drinks` | 10 min | None | Commodity beverage prices |

## Moderate (15–60 min)

| Source | ID | Update | Auth | Notes |
|--------|----|--------|------|-------|
| Ryanair | `ryanair` | 15 min | None | Cheapest one-way fares (40 airports) |
| NOAA Tides | `noaa_tides` | 15 min | None | Tide levels |
| Weather Stations | `weather_stations` | 15 min | None | Open-Meteo city weather. Dir: `weather` |
| NPM | `npm` | 30 min | None | JS package downloads |
| Movebank | `movebank` | 30 min | None | Animal migration tracking |
| Wildfire | `wildfire` | 30 min | None | NIFC active fires |
| Shelter | `shelter` | 30 min | None | Animal shelter availability |
| Epidemic | `epidemic` | 30 min | None | Disease outbreak data |

## Hourly

| Source | ID | Update | Auth | Notes |
|--------|----|--------|------|-------|
| Adzuna | `adzuna` | 1 hr | `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` | Job listings |
| USA Spending | `usa_spending` | 1 hr | None | Federal contract spending |
| Zillow | `zillow` | 1 hr | None | Housing market data |
| PyPI | `pypi` | 1 hr | None | Python package downloads |
| NASDAQ (bchain) | `bchain` | 1 hr | `NASDAQ_API_KEY` | Bitcoin on-chain metrics |

## Scheduled (Market Hours / Daily / Weekly)

| Source | ID | Schedule | Auth | Notes |
|--------|----|----------|------|-------|
| FRED (Rates) | `rates` | 6-7 PM ET daily; burst on FOMC days | `FRED_API_KEY` | Interest rates, mortgage rates. Dir: `fred` |
| BLS | `bls` | Monthly release windows | `BLS_API_KEY` | Employment, CPI data |
| Treasury | `bonds` | US market hours only | None | Bond yields. Dir: `treasury` |
| ECB | `ecb` | 12-2 PM CET daily | None | Euro exchange rates |
| Bank of England | `boe` | 9:45 AM / 12 PM London daily | None | Sterling FX rates, 27 currencies |
| EIA | `eia` | 9:30 AM ET release window | `EIA_API_KEY` | Energy data |
| Congress | `congress` | 9-6 ET weekdays | `CONGRESS_API_KEY` | Legislative activity |
| SEC EDGAR | `sec_13f` | 6-9 PM ET weekdays | `SEC_USER_AGENT` | 13F institutional holdings. Dir: `sec_edgar` |
| SEC ETFs | `sec_efts` | 9:30 AM - 4 PM ET | `SEC_USER_AGENT` | ETF flow data |
| SEC Insider | `sec_insider` | 6-9 PM ET weekdays | `SEC_USER_AGENT` | Insider trading |
| FINRA Short Interest | `finra` | Every 12 hr | `FINRA_CLIENT_ID` + `FINRA_CLIENT_SECRET` | Bi-monthly consolidated short interest (OAuth) |
| FINRA Short Vol | `finra_short_vol` | 3:30 PM ET weekdays | None | Daily short volume |
| CFTC | `cftc` | Friday 3:30 PM ET | `NASDAQ_API_KEY` | Commitments of traders. Via Nasdaq Data Link |
| Futures (CHRIS) | `futures` | Market hours | `NASDAQ_API_KEY` | Continuous front-month commodity futures. Dir: `nasdaq/chris.rs` |
| OPEC | `opec` | Weekly Thursday | `NASDAQ_API_KEY` | Oil production data. Via Nasdaq Data Link |
| IMF | `imf` | Monthly | `NASDAQ_API_KEY` | Macroeconomic indicators. Via Nasdaq Data Link |
| World Bank | `worldbank` | Weekly | None | Global development indicators |

## Disabled

| Source | ID | Reason |
|--------|----|--------|
| eBird | `ebird` | API key expired (403) — needs new key from ebird.org/api/keygen |
| NRC Nuclear | `nrc_nuclear` | nrc.gov unreachable from EU VPS (TLS/HTTP2 hangs) |
| CBP Border | `cbp_border` | bwt.cbp.dhs.gov returns 403 from EU VPS |
| Reddit | `reddit` | Public mode returns 0 data — needs OAuth credentials |

## Notes

- **Dir annotations**: Where the directory name differs from the source ID, `Dir:` shows the filesystem location under `data-node/src/market_data/sources/`.
- **Nasdaq Data Link**: `bchain`, `cftc`, `futures`, `opec`, `imf` all share the `NASDAQ_API_KEY` credential and rate limits via the shared `nasdaq/client.rs` HTTP client.
- **Env-configurable intervals**: CoinGecko, DefiLlama, Finnhub, Polymarket, and Open-Meteo accept `*_SYNC_INTERVAL_SECS` env vars to override defaults.
- **Display config**: `data-node/config/sources-display.json` controls frontend presentation (names, logos, categories, prefixes). Some display entries group multiple source IDs — e.g., `sec` groups `sec_13f`, `sec_efts`, `sec_insider`.
- **Source ID ≠ display ID**: Frontend uses display IDs (e.g., `coingecko`, `defillama`, `finnhub`). The mapping lives in `frontend/lib/vision/sources.ts` `DISPLAY_TO_INTERNAL`.
