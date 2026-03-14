# Data Sources

All market data sources powering Vision, organized by category with update frequencies.

**Last updated:** 2026-03-14

## Real-Time (< 5 min)

| Source | ID | Update | Auth | Notes |
|--------|----|--------|------|-------|
| AIS Ship Tracking | `aisstream` | 1s (WebSocket) | `AISSTREAM_API_KEY` | Live vessel positions |
| Twitch | `twitch` | 1 min | `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` | Viewer counts |
| GTFS Real-Time | `gtfs_rt` | 2 min | None | Transit delays (static feed URLs) |
| Sports | `sports` | 5 min | None | Live scores (TheSportsDB) |
| DB Trains | `db_trains` | 5 min | None | Deutsche Bahn delays (IRIS-TTS) |
| ISS Tracker | `iss` | 5 min | None | Space station position |
| PumpFun | `pumpfun` | 5 min | None | Solana token launches |
| CityBikes | `citybikes` | 5 min | None | Bike-share availability |
| MTA Subway | `mta_subway` | 5 min | None | NYC subway delays |
| Paris Metro | `paris_metro` | 5 min | None | RATP metro status |
| TfL Tube | `tfl_tube` | 5 min | None | London Underground status |
| Lichess | `lichess` | 5 min | None | Online chess players |

## Standard (5–15 min)

| Source | ID | Update | Auth | Notes |
|--------|----|--------|------|-------|
| CoinGecko | `crypto` | 10 min | `COINGECKO_API_KEY` (optional) | Crypto prices |
| DefiLlama | `defi` | 10 min | None | TVL data |
| Polymarket | `polymarket` | 10 min | None | Prediction market prices |
| Finnhub | `stocks` | 10 min | `FINNHUB_API_KEY` | US stock prices |
| TMDB | `tmdb` | 10 min | `TMDB_API_KEY` | Movie popularity |
| AniList | `anilist` | 10 min | None | Anime/manga popularity |
| Steam | `steam` | 10 min | None | Game player counts |
| Backpack.tf | `backpacktf` | 10 min | None | TF2 item prices |
| HackerNews | `hackernews` | 10 min | None | Story scores |
| Crates.io | `crates_io` | 10 min | None | Rust crate downloads |
| NPM | `npm` | 10 min | None | JS package downloads |
| PyPI | `pypi` | 10 min | None | Python package downloads |
| 4chan | `fourchan` | 10 min | None | Thread activity |
| Chaturbate | `chaturbate` | 10 min | None | Viewer counts |
| GitHub | `github` | 10 min | `GITHUB_TOKEN` (optional) | Repo star counts |
| Last.fm | `lastfm` | 10 min | `LASTFM_API_KEY` | Artist listeners |
| Cloudflare Radar | `cloudflare` | 10 min | `CF_API_TOKEN` | Domain rankings |
| Earthquake | `earthquake` | 10 min | None | USGS seismic data |
| Volcano | `volcano` | 10 min | None | Smithsonian eruption alerts |
| SpaceWeather | `spaceweather` | 10 min | None | Solar activity (NOAA SWPC) |
| Wildfire | `wildfire` | 10 min | None | NIFC active fires |
| Flights | `flights` | 10 min | None | FlightAware stats |
| Maritime | `maritime` | 10 min | None | Digitraffic vessel data |
| Epidemic | `epidemic` | 10 min | None | Disease outbreak data |
| Weather Alerts | `weather_alerts` | 10 min | None | NWS alerts |
| Animals | `animals` | 10 min | None | Wildlife sighting data |
| Movebank | `movebank` | 10 min | None | Animal migration tracking |
| Mil Aircraft | `mil_aircraft` | 10 min | `ADSBX_API_KEY` | Military aircraft tracking |
| PandaScore | `esports` | 10 min | `PANDASCORE_API_KEY` | Esports match data |
| USGS Water | `usgs_water` | 10 min | None | River gauge data |
| NOAA Tides | `noaa_tides` | 10 min | None | Tide levels |
| NDBC | `ndbc` | 10 min | None | Marine buoy data |
| NOAA Met | `noaa_met` | 10 min | None | Weather observations |
| NWPS | `nwps` | 10 min | None | Wave predictions |
| AirNow | `airnow` | 10 min | `AIRNOW_API_KEY` | Air quality index |
| CrossRef | `crossref` | 10 min | None | Academic citation counts |
| OpenAlex | `openalex` | 10 min | None | Research paper metrics |
| PubMed | `pubmed` | 10 min | None | Medical paper citations |
| StackExchange | `stackexchange` | 10 min | `STACKEXCHANGE_KEY` | Q&A activity |
| CourtListener | `courtlistener` | 10 min | `COURTLISTENER_API_KEY` | Court case filings |
| NYC 311 | `nyc311` | 10 min | None | NYC complaints |
| McBroken | `mcbroken` | 10 min | None | McDonald's ice cream machine status |
| Shelter | `shelter` | 10 min | None | Animal shelter availability |

## Moderate (15–60 min)

| Source | ID | Update | Auth | Notes |
|--------|----|--------|------|-------|
| Ryanair | `ryanair` | 15 min | None | Cheapest one-way fares (40 airports) |
| FAA Delays | `faa_delays` | 15 min | None | US airport delays |
| Queue Times | `queue_times` | 15 min | None | Theme park wait times |
| Parking | `parking` | 15 min | None | City parking availability |
| Yahoo Drinks | `yahoo_drinks` | 15 min | None | Commodity beverage prices |
| Best Buy | `bestbuy` | 15 min | `BESTBUY_API_KEY` | Product prices |
| Adzuna | `adzuna` | 15 min | `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` | Job listings |
| TomTom Traffic | `tomtom_traffic` | 15 min | `TOMTOM_API_KEY` | Traffic congestion |
| TomTom EV Charge | `tomtom_evcharge` | 15 min | `TOMTOM_API_KEY` | EV charger availability |
| BoardGameGeek | `bgg` | 30 min | None | Board game rankings |
| USA Spending | `usa_spending` | 1 hr | None | Federal contract spending |
| Power Outages | `power_outages` | 1 hr | None | US power outage counts |
| Zillow | `zillow` | 1 hr | None | Housing market data |
| TWSE | `twse` | 1 hr | None | Taiwan stock exchange |
| NASDAQ | `bchain` | 1 hr | `NASDAQ_API_KEY` | Blockchain metrics |

## Scheduled (Market Hours / Daily / Weekly)

| Source | ID | Schedule | Auth | Notes |
|--------|----|----------|------|-------|
| FRED (Rates) | `rates` | 6-7 PM ET daily; burst on FOMC days | `FRED_API_KEY` | Interest rates, mortgage rates |
| BLS | `bls` | Monthly release windows | `BLS_API_KEY` | Employment, CPI data |
| Treasury | `bonds` | US market hours only | None | Bond yields |
| ECB | `ecb` | 12-2 PM CET daily | None | Euro exchange rates |
| EIA | `eia` | 9:30 AM ET release window | `EIA_API_KEY` | Energy data |
| Congress | `congress` | 9-6 ET weekdays | `CONGRESS_API_KEY` | Legislative activity |
| SEC EDGAR | `sec_edgar` | 6-9 PM ET weekdays | `SEC_USER_AGENT` | Company filings |
| SEC ETFs | `sec_efts` | 9:30 AM - 4 PM ET | `SEC_USER_AGENT` | ETF flow data |
| SEC Insider | `sec_insider` | 6-9 PM ET weekdays | `SEC_USER_AGENT` | Insider trading |
| FINRA Short Vol | `finra_short_vol` | 3:30 PM ET weekdays | None | Short volume |
| CFTC | `cftc` | Friday 3:30 PM ET | `NASDAQ_API_KEY` | Commitments of traders |
| CHRIS (Futures) | `chris` | Market hours | `NASDAQ_API_KEY` | Commodity futures |
| OPEC | `opec` | Weekly Thursday | `NASDAQ_API_KEY` | Oil production data |
| IMF | `imf` | Monthly | `NASDAQ_API_KEY` | Macroeconomic indicators |
| World Bank | `worldbank` | Weekly | None | Global development indicators |

## Disabled

| Source | ID | Reason |
|--------|----|--------|
| eBird | `ebird` | API key expired (403) — needs new key from ebird.org/api/keygen |
| NRC Nuclear | `nrc_nuclear` | nrc.gov unreachable from EU VPS (TLS/HTTP2 hangs) |
| CBP Border | `cbp_border` | bwt.cbp.dhs.gov returns 403 from EU VPS |
| IODA Internet | `ioda` | CAIDA IODA API returns 0 prices (broken response) |
| Reddit | `reddit` | Public mode returns 0 data — needs OAuth credentials |
| OpenMeteo | `weather` | Disabled by default (sync interval = 0, needs explicit config) |
