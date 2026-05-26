# Client-direct feasibility — CORS audit of all 94 sources

**Probed 2026-05-26** against production upstreams with `Origin: https://generalmarket.io`. Companion to `2026-05-25-live-human-markets-design.md`. Decides which sources the browser can poll directly (the *client-direct* path) vs which must stay on the *server-feed* path.

**Gate for client-direct:** keyless **and** CORS-open **and** HTTPS (no mixed content). Everything else uses the server-feed refetch baseline (the data-node already holds the key / proxies it).

Tally: **44 client-direct ✅** · 29 need a key 🔑 · 17 CORS-blocked ⛔ · 4 caveat ⚠️.

## ✅ Client-direct possible (44) — keyless + CORS-open

The data-node already has the parser for each; the `value field` is what the chart reads.

| Source | Endpoint | Value field |
|---|---|---|
| binance_spot | `api.binance.com/api/v3/ticker/price` | `price` |
| binance_futures_funding | `fapi.binance.com/fapi/v1/premiumIndex` | premium / `lastFundingRate` |
| pumpfun | `lite-api.jup.ag/price/v3?ids=<mint>` | `price_usd` |
| polymarket | `gamma-api.polymarket.com/markets?closed=false` | `yes_price` |
| chaturbate | `chaturbate.com/api/public/affiliates/onlinerooms/?format=json` | `num_users` |
| sports | `site.api.espn.com/apis/site/v2/sports/.../scoreboard` | live score |
| citybikes | `api.citybik.es/v2/networks/<net>` | Σ `free_bikes` |
| mta_subway | `api.subwaynow.app/routes` | disrupted-line count |
| maritime | `meri.digitraffic.fi/api/ais/v1/locations` | vessel count / pos |
| gtfs_rt | `api-endpoint.mta.info/Dataservice/mtagtfsfeeds/...` | vehicle pos (protobuf) |
| db_trains | `iris.noncd.db.de/iris-tts/timetable/...` | avg delay min |
| defillama | `api.llama.fi/v2/chains` (+ `/protocols`, `/overview/dexs`) | `tvl` |
| earthquake | `earthquake.usgs.gov/.../all_hour.geojson` | quake count / max `mag` |
| hackernews | `hacker-news.firebaseio.com/v0/item/<id>.json` | `score` / `descendants` |
| spaceweather | `services.swpc.noaa.gov/products/noaa-planetary-k-index.json` | latest Kp |
| usgs_water | `waterservices.usgs.gov/nwis/iv/?...` | discharge cfs |
| nwps | `api.water.noaa.gov/nwps/v1/gauges/<id>` | `observed.primary` stage |
| noaa_tides | `api.tidesandcurrents.noaa.gov/.../datagetter?product=water_level` | water level |
| noaa_met | `api.tidesandcurrents.noaa.gov/.../datagetter?product=water_temperature` | temp / wind |
| weather | `api.open-meteo.com/v1/forecast?current=temperature_2m,...` | `current.*` |
| openmeteo | `api.open-meteo.com/...` (same host as weather → open) | air-quality metric |
| parking | `api.parkendd.de/<city>` | Σ free spaces |
| lichess | `lichess.org/api/player` | top `perf.rating` |
| npm | `api.npmjs.org/downloads/point/last-day/<pkg>` | downloads |
| crates_io | `crates.io/api/v1/crates?sort=downloads` | `recent_downloads` |
| anilist | `graphql.anilist.co` (POST) | `Media.trending` |
| animals | `api.gbif.org/v1/occurrence/search`, `api.inaturalist.org/v1/observations` | `count` |
| crossref | `api.crossref.org/works?filter=...&rows=0` | `total-results` |
| openalex | `api.openalex.org/works?group_by=...` | group count |
| ioda | `api.ioda.inetintel.cc.gatech.edu/v2/signals/raw/...` | BGP signal |
| ecb | `data-api.ecb.europa.eu/service/data/FM/...` | latest observation |
| finra_short_vol | `cdn.finra.org/equity/regsho/daily/CNMSshvol<date>.txt` | short/total ratio |
| treasury | `home.treasury.gov/.../xml?data=daily_treasury_yield_curve` | latest yield |
| usa_spending | `api.usaspending.gov/api/v2/agency/<id>/budgetary_resources/` | budget $ |
| worldbank | `api.worldbank.org/v2/country/.../indicator/...?format=json` | latest value |
| zillow | `files.zillowstatic.com/research/public_csvs/zhvi/...csv` | last month col |
| sec_edgar | `data.sec.gov/submissions/CIK<n>.json` | 13F aum / positions |
| nyc311 | `data.cityofnewyork.us/resource/erm2-nwe9.json?$select=...` | complaint count |
| shelter | `data.austintexas.gov/resource/<id>.json?$select=count(*)` | row count |
| volcano | `volcanoes.usgs.gov/vsc/api/volcanoApi/elevated` | alert level |
| weather_alerts | `api.weather.gov/alerts/active` | active-alert count |
| epidemic | `disease.sh/v3/covid-19/all` | metric |
| ryanair | `services-api.ryanair.com/farfnd/v4/oneWayFares?...` | fare EUR |
| iss ⚠️ | `api.open-notify.org/iss-now.json` | lat/lon — **HTTP only → mixed-content blocked**; needs an HTTPS mirror or server-feed |

**Worth polling fast (intraday movers):** binance_spot, binance_futures_funding, pumpfun, polymarket, chaturbate, sports, citybikes, mta_subway, maritime, gtfs_rt, db_trains, defillama, hackernews, spaceweather, usgs_water, nwps, noaa_tides, noaa_met, weather, parking, earthquake, ioda.

**Open but slow-cadence (CORS-fine, but live polling adds little — daily/weekly/yearly data):** zillow, worldbank, usa_spending, sec_edgar, treasury, ecb, finra_short_vol, crossref, openalex, volcano, nyc311, shelter, epidemic, anilist, animals, npm, crates_io, lichess, ryanair, weather_alerts. These get the server-feed baseline; no need for a browser adapter.

## 🔑 Needs a key (29) → server-feed path

adzuna, airnow*, aisstream, backpacktf, bestbuy, bgg, bls, cloudflare, coingecko†, congress, courtlistener*, ebird*, eia, finnhub, finra, fred, github, lastfm, nasdaq, pandascore, power_outages‡, pubmed, reddit*, stackexchange, tfl_tube*, tmdb, tomtom_evcharge, tomtom_traffic, twitch.

`*` key is optional in code (airnow/ebird/courtlistener/reddit/tfl_tube) — could degrade to keyless if the upstream allows, to verify. `†` coingecko free tier (`api.coingecko.com`) works keyless — reclassify if we drop the pro key. `‡` power_outages ships a default key in the URL.

## ⛔ Keyless but CORS-blocked (17) → server-feed path

binance_options, boe, cbp_border, faa_delays, flights (adsb.lol), mcbroken, mil_aircraft, ndbc, nrc_nuclear, queue_times, sec_efts, sec_insider, steam, tubes (eporner), twse, wildfire (also needs NASA key), yahoo_drinks.

## ⚠️ Caveats (4)

- **fourchan** — ACAO fixed to `http://boards.4chan.org`; rejects our origin → server-feed.
- **movebank** — CORS `*` but returns 401 (license/key wall) → server-feed.
- **paris_metro** — data-node stub (never actually fetched); needs an `apikey` header.
- **pypi** — value endpoint `pypistats.org` sends no ACAO (blocked); only the discovery list is open → server-feed.

## Takeaway

Client-direct browser polling is the cheap, server-load-free path for ~44 sources, and ~22 of those are genuine intraday movers worth sub-minute polling — the crypto/prices/odds/viewers/positions/counts that actually change while you watch. Everything else (keys, blocked CORS, or slow cadence) rides the universal server-feed refetch baseline, which the data-node already feeds. One chart, two feed paths, picked per source.
