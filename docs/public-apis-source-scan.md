# Public APIs Source Scan — 1,425 APIs Evaluated

Scanned from [public-apis/public-apis](https://github.com/public-apis/public-apis).
Criteria: continuous numeric data, updates ≤10min, interesting for prediction markets.

**Legend:** `VERIFIED` = actually curled the endpoint and read real docs. `UNVERIFIED` = verdict based on description only.

---

## VERIFIED CANDIDATES — Real endpoints tested

### 1. RuneScape Grand Exchange `VERIFIED` **YES — TOP PRIORITY**

| Field | Value |
|-------|-------|
| API | `https://prices.runescape.wiki/api/v1/osrs` |
| Auth | None (custom User-Agent required, default agents blocked) |
| Rate limit | No hard limit. "Don't do multiple large queries per second sustained" |
| Items | **4,525 tradeable**, ~3,200 traded/hr, ~1,800 traded/5min |
| Data | `high` (instant-buy), `low` (instant-sell) prices + volumes per item |
| Granularity | `/latest` = real-time, `/5m` = 5-min aggregates, `/1h` = hourly |
| Update freq | Real-time (last-trade timestamps within seconds) |
| License | Open |
| Pattern | Batch IDs — `/latest` returns all 4,500 items in one call |

**Why it's great:** Free virtual stock exchange. 4,500 items with real supply/demand. One API call gets everything. OSRS community obsesses over GE prices.

---

### 2. UK Electricity Grid (2 APIs) `VERIFIED` **YES — TOP PRIORITY**

#### 2a. Elexon BMRS — GB grid frequency + generation

| Field | Value |
|-------|-------|
| API | `https://data.elexon.co.uk/bmrs/api/v1` |
| Auth | None |
| Rate limit | None observed (20 rapid-fire requests all 200) |
| Feeds | **System frequency (Hz)** every 15s, **generation by fuel (MW)** every 5min (20 fuel types), **demand (MW)** every 30min, peak demand daily |
| Data | Frequency: 50.136 Hz. Wind: 8,161 MW. CCGT: 6,630 MW. Demand: 26,443 MW. |
| License | BMRS Data Licence |
| Pattern | Single call → fan out (one call per dataset, many feeds) |

#### 2b. Carbon Intensity API — gCO2/kWh by region

| Field | Value |
|-------|-------|
| API | `https://api.carbonintensity.org.uk` |
| Auth | None |
| Rate limit | None observed |
| Feeds | National intensity (forecast + actual), **17 regions** each with intensity + generation mix (9 fuel types as %) |
| Update freq | Every 30 min (settlement periods) |
| License | CC BY 4.0 |

**Why it's great:** Grid frequency oscillates around 50Hz every 15 seconds — highest-frequency feed we'd have. Generation mix shifts constantly with wind/demand. No auth, no limits, government-backed.

---

### 3. iRail — Belgian Train Delays `VERIFIED` **YES**

| Field | Value |
|-------|-------|
| API | `https://api.irail.be/v1/` |
| Auth | None (User-Agent recommended) |
| Rate limit | **3 req/s** burst 5. HTTP 429 on exceed. |
| Stations | **713 stations** |
| Data | `delay` in **seconds** per departure, `canceled` boolean, `occupancy` (low/medium/high) |
| Endpoints | `/liveboard?station=X` (per-station departures), `/vehicle?id=X` (per-train per-stop delays), `/disturbances` (disruptions) |
| Update freq | Real-time |
| License | Open |
| Pattern | Grouped by station — one call per station |

**Why it's great:** Same pattern as DB Trains. Delays in seconds, 713 stations, no auth. Pick top 20-30 stations, compute avg delay. Quick integration.

---

### 4. FFXIV Universalis — Virtual Economy `VERIFIED` **MAYBE**

| Field | Value |
|-------|-------|
| API | `https://universalis.app/api/v2` |
| Auth | None |
| Rate limit | ~10 req/s safe. >20 concurrent triggers Cloudflare 429. |
| Items | **16,736 tradeable** across **128 servers** |
| Data | `currentAveragePrice`, `minPrice`, `maxPrice`, `regularSaleVelocity`, per-listing prices |
| Multi-item | Up to 100 items comma-separated per request |
| Update freq | **Crowdsourced** — popular items: seconds. Niche items: hours/days. `lastUploadTime` field shows freshness. |
| License | Open |

**Caveat:** Data is crowdsourced from player plugins, not official. Popular items are fresh, niche items go stale. Need to filter by `lastUploadTime` freshness.

---

### 5. Lichess — Chess Ratings `VERIFIED` **MAYBE**

| Field | Value |
|-------|-------|
| API | `https://lichess.org/api` |
| Auth | None for public endpoints |
| Rate limit | No published number. "One request at a time." 15 rapid requests all succeeded. |
| Data | Top player ratings (14 variants), tournament player counts, live streamer count, daily puzzle rating |
| Realistic feeds | **12-18** (top ratings per variant, tournament counts, Magnus tracker) |
| Update freq | Ratings change per game (minutes-hours). Tournaments real-time. |
| Limitation | No global online player count via REST (WebSocket only) |

**Caveat:** Low feed count (~15). Ratings change slowly outside of top players actively playing. Medium value.

---

### 6. BC Ferries — Sailing Capacity `VERIFIED` **MAYBE**

| Field | Value |
|-------|-------|
| API | `https://www.bcferriesapi.ca/v2/capacity/` |
| Auth | None |
| Rate limit | None observed (community project, be polite — poll every 2-5min) |
| Routes | **12 routes** with live capacity data |
| Data | `fill` (0-100%), `carFill`, `oversizeFill`, vessel names, sailing times |
| Delays | Embedded in `vesselName` string ("Delayed approx. 14m Queen of Alberni") — needs parsing |
| License | MIT |

**Caveat:** Community project by one developer. No SLA. Only 12 routes. Delays need string parsing. Small but unique.

---

### 7. Metro Lisboa — Subway Status `VERIFIED` **MAYBE**

| Field | Value |
|-------|-------|
| API | `https://app.metrolisboa.pt/status/getLinhas.php` |
| Auth | None |
| Rate limit | None observed |
| Lines | **4 lines** (Yellow, Blue, Green, Red) |
| Data | Status text ("Ok" / disruption message), `tipo_msg` severity code (0 = normal) |
| Update freq | Real-time |

**Caveat:** Only 4 feeds. Status text, not numeric delay. Same pattern as MTA/TfL (convert to severity score). Very quick win but tiny.

---

### 8. Wikipedia Pageviews `VERIFIED` **NO for real-time, MAYBE for daily**

| Field | Value |
|-------|-------|
| API | `https://wikimedia.org/api/rest_v1/metrics/pageviews/` |
| Auth | None (User-Agent courtesy) |
| Rate limit | None observed |
| Data | Daily views per article, top articles ranking |
| Granularity | **Daily only** (hourly returns 400) |
| Delay | **24-48 hours** — data for day N available on day N+2 |

**Verdict:** Too slow for our 10-min polling. Could work as a ScheduledSyncEngine (daily at midnight), but low priority.

---

### 9. Tankerkoenig — German Gas Prices `VERIFIED` **BLOCKED**

| Field | Value |
|-------|-------|
| API | `https://creativecommons.tankerkoenig.de/api/v4` |
| Auth | API key required |
| Rate limit | Min 5 min between queries. Exceed = **key deactivation**. |
| Data | Per-station E5/E10/Diesel prices, national avg/median via `/stats` |
| Coverage | 14,000+ German stations |
| Update freq | Every 4 min upstream (MTS-K data) |
| **BLOCKER** | **Registration currently closed** ("keine Registrierungen möglich") |

**Verdict:** Good source in theory but can't get an API key right now.

---

### 10. balldontlie — NBA Stats `VERIFIED` **PAID**

| Field | Value |
|-------|-------|
| API | `https://api.balldontlie.io/v1` |
| Auth | API key required |
| Free tier | **5 req/min**, games/teams/players only (live scores included) |
| $9.99/mo | Player per-game stats (pts, reb, ast, etc.) — 60 req/min |
| $39.99/mo | Live box scores, play-by-play, betting odds — 600 req/min |
| Data | Live game scores (free), player stats per game (paid) |

**Verdict:** Free tier too limited (5 req/min, no player stats). $9.99/mo for useful data. Not a priority unless we want to pay.

---

### 11. Ergast F1 `VERIFIED` **DEAD**

Original ergast.com DNS doesn't resolve. Successor **Jolpica** (`api.jolpi.ca/ergast/f1/`) works but:
- Post-race data only (not real-time during races)
- **Non-commercial license** (CC BY-NC-SA 4.0)
- 500 req/hr, volunteer-run

**Verdict:** No. Not real-time, non-commercial.

---

### 12. AQICN / OpenAQ — Global Air Quality `VERIFIED` **MIXED**

| API | Auth | Rate limit | Update freq | License issue |
|-----|------|-----------|-------------|---------------|
| AQICN | API key (free) | 1000 req/s | Hourly | **Non-commercial** (can't sell/redistribute) |
| OpenAQ v3 | API key (free) | 60 req/min, 2000/hr | Varies by station | Open data — OK |

**Verdict:** AQICN has great data (11K+ stations) but non-commercial license kills it. OpenAQ v3 is open but lower rate limits. We already have AirNow for US. OpenAQ would add international cities (Delhi, Beijing, London). Low priority since we have AirNow.

---

## FULL 1,425-API SCAN — Unverified one-line verdicts

Every API from public-apis evaluated. Unverified = based on description, not tested.

### Animals (27)
| API | Verdict | Reason |
|-----|---------|--------|
| AdoptAPet | NO | Pet listings, not numeric |
| Axolotl | NO | Pictures |
| Cat Facts | NO | Random text |
| Cataas | NO | Cat images |
| Cats | NO | Cat images |
| Dog Facts (x2) | NO | Random text |
| Dogs | NO | Image dataset |
| eBird | **HAVE** | Already integrated |
| FishWatch | NO | Static species info |
| HTTP Cat | NO | Joke images |
| HTTP Dog | NO | Joke images |
| IUCN | NO | Conservation status, rarely changes |
| MeowFacts | NO | Random text |
| Movebank | **HAVE** | Already integrated |
| Petfinder | NO | Pet listings, not continuous numeric |
| PlaceBear/PlaceDog/PlaceKitten | NO | Placeholder images |
| RandomDog/Duck/Fox | NO | Random images |
| RescueGroups | NO | Pet adoption listings |
| Shibe.Online | NO | Random images |
| The Dog | NO | Dog breed info |
| xeno-canto | NO | Bird audio recordings |
| Zoo Animals | NO | Static facts |

### Anime (19)
| API | Verdict | Reason |
|-----|---------|--------|
| AniAPI | NO | Discovery/streaming, not numeric |
| AniDB | NO | Database, slow-changing |
| AniList | **HAVE** | Already integrated |
| AnimeChan | NO | Quotes |
| AnimeFacts | NO | Static facts |
| AnimeNewsNetwork | NO | News articles |
| Catboy | NO | Images |
| Danbooru | NO | Art database |
| Jikan | MAYBE | MyAnimeList proxy — could track anime popularity scores, but changes slowly (weekly). Low priority. |
| Kitsu | NO | Discovery platform, OAuth required |
| MangaDex | NO | Manga reading platform |
| Mangapi | NO | Translation tool |
| MyAnimeList | NO | OAuth, overlaps AniList |
| NekosBest | NO | Images |
| Shikimori | NO | OAuth, Russian MAL clone |
| Studio Ghibli | NO | Static film data |
| Trace Moe | NO | Image search tool |
| Waifu.im/pics | NO | Images |

### Anti-Malware (15)
| API | Verdict | Reason |
|-----|---------|--------|
| All 15 | NO | Security scanning tools, not continuous market data |

### Art & Design (20)
| API | Verdict | Reason |
|-----|---------|--------|
| All 20 | NO | Static art, icons, images, color tools |

### Authentication & Authorization (7)
| API | Verdict | Reason |
|-----|---------|--------|
| All 7 | NO | Auth services, not data |

### Blockchain (11)
| API | Verdict | Reason |
|-----|---------|--------|
| Etherscan | NO | Covered by CoinGecko + bchain |
| Helium | MAYBE | Hotspot count could be numeric feed. Unverified. |
| All others | NO | Covered by existing crypto sources or dev tools |

### Books (23)
| API | Verdict | Reason |
|-----|---------|--------|
| Crossref | **HAVE** | Already integrated |
| All others | NO | Static text/reference data |

### Business (22)
| API | Verdict | Reason |
|-----|---------|--------|
| Tenders (Hungary/Poland/Romania/Spain/Ukraine) | MAYBE | Procurement count per country could be numeric. Updates daily. Low priority, 5 feeds max. Unverified. |
| All others | NO | CRM, email, project tools |

### Calendar (16)
| API | Verdict | Reason |
|-----|---------|--------|
| All 16 | NO | Static holiday/calendar reference data |

### Cloud Storage (19)
| API | Verdict | Reason |
|-----|---------|--------|
| All 19 | NO | File hosting services |

### Continuous Integration (6)
| API | Verdict | Reason |
|-----|---------|--------|
| All 6 | NO | CI/CD tools |

### Cryptocurrency (64)
| API | Verdict | Reason |
|-----|---------|--------|
| CoinGecko | **HAVE** | Already integrated |
| Mempool | MAYBE | Bitcoin mempool size (tx count, fee rates) changes every block (~10min). No auth. Could give 5-10 feeds. Unverified. |
| All others (62) | NO | Covered by CoinGecko, or exchange-specific trading APIs we don't need |

### Currency Exchange (17)
| API | Verdict | Reason |
|-----|---------|--------|
| Frankfurter | MAYBE | Free, no auth, ECB forex rates. But we already have ECB source. Redundant. |
| All others | NO | Covered by ECB source, or paid/low-limit |

### Data Validation (7)
| API | Verdict | Reason |
|-----|---------|--------|
| All 7 | NO | Address/email/VAT validation tools |

### Development (120)
| API | Verdict | Reason |
|-----|---------|--------|
| GitHub | **HAVE** | Already integrated |
| npm Registry | **HAVE** | Already integrated |
| DigitalOcean Status | MAYBE | Service status (up/degraded/down) for DO services. Tiny feed count. Unverified. |
| Google Trends (unofficial) | MAYBE | Search interest scores by keyword. Could track 50 trending topics. **But unofficial/fragile.** Unverified. |
| CountAPI | NO | Simple counter service |
| All others (115) | NO | Dev tools, screenshots, IP lookups, scraping services |

### Dictionaries (13)
| API | Verdict | Reason |
|-----|---------|--------|
| All 13 | NO | Word definitions, static reference |

### Documents & Productivity (28)
| API | Verdict | Reason |
|-----|---------|--------|
| All 28 | NO | Doc conversion, project mgmt, productivity tools |

### Email (17)
| API | Verdict | Reason |
|-----|---------|--------|
| All 17 | NO | Email sending/validation services |

### Entertainment (10)
| API | Verdict | Reason |
|-----|---------|--------|
| All 10 | NO | Jokes, facts, memes — random generators |

### Environment (17)
| API | Verdict | Reason |
|-----|---------|--------|
| UK Carbon Intensity | **YES** | `VERIFIED` — see above |
| National Grid ESO | **YES** | `VERIFIED` — see above (Elexon BMRS) |
| GrünstromIndex | MAYBE | German green power %. No auth. But HTTP only (no HTTPS). Unverified endpoint. |
| Danish Energi Data | MAYBE | Danish electricity spot prices. No auth. Unverified. |
| OpenAQ | MAYBE | `VERIFIED` — v3 needs key, 60 req/min. We have AirNow for US already. |
| IQAir | NO | Non-commercial license |
| BreezoMeter Pollen | NO | Paid API |
| Luchtmeetnet | MAYBE | Netherlands air quality, no auth. Unverified. |
| PM2.5 Open Data Portal | MAYBE | Taiwan PM2.5 sensors. Unverified. |
| PVWatts | NO | Solar energy modeling, not live |
| Srp Energy | NO | Single utility, OAuth |
| Carbon Interface/Climatiq/Cloverly/CO2 Offset | NO | Carbon calculation tools, not data |
| Website Carbon | NO | Calculator, not data |

### Events (3)
| API | Verdict | Reason |
|-----|---------|--------|
| Eventbrite/SeatGeek/Ticketmaster | NO | Event listings, not continuous numeric. Ticket prices could work but need OAuth/paid. |

### Finance (45)
| API | Verdict | Reason |
|-----|---------|--------|
| Finnhub | **HAVE** | Already integrated |
| FRED | **HAVE** | Already integrated |
| Fed Treasury | **HAVE** | Already integrated |
| SEC EDGAR | **HAVE** | Already integrated |
| Alpaca | MAYBE | Free real-time US equities. 200 req/min free tier. Overlaps Finnhub. Unverified. |
| IEX Cloud | NO | Paid (free tier deprecated) |
| Polygon | NO | 5 req/min free — too low |
| Alpha Vantage | NO | 25 req/day free — too low |
| Twelve Data | NO | 800 req/day free — too low for continuous polling |
| WallstreetBets | MAYBE | WSB sentiment scores per ticker. No auth. Unverified. |
| Indian Mutual Fund | MAYBE | India MF NAVs, no auth. Daily updates only. Unverified. |
| Econdb | MAYBE | Global macro data, no auth. Unverified. |
| Tradier | NO | OAuth required |
| Yahoo Finance | NO | Unofficial, rate-limited |
| All others (29) | NO | Payment processors, banking APIs, tax tools, or covered by existing sources |

### Food & Drink (24)
| API | Verdict | Reason |
|-----|---------|--------|
| Untappd | MAYBE | Beer check-in counts/ratings could be numeric. OAuth required though. Unverified. |
| Open Brewery DB | NO | Static brewery listings |
| All others (22) | NO | Recipes, nutrition facts, food images |

### Games & Comics (96)
| API | Verdict | Reason |
|-----|---------|--------|
| Board Game Geek | **HAVE** | Already integrated |
| PandaScore | **HAVE** | Already integrated |
| Steam | **HAVE** | Already integrated |
| Chess.com | MAYBE | Online player count, top ratings. No auth. Similar to Lichess but Chess.com is bigger. Unverified. |
| Lichess | **YES** | `VERIFIED` — 12-18 feeds, top ratings, tournaments |
| CheapShark | MAYBE | PC game sale prices across stores. No auth. Unverified. |
| Universalis (FFXIV) | **MAYBE** | `VERIFIED` — 16K items but crowdsourced freshness |
| RuneScape | **YES** | `VERIFIED` — 4,500 items, real-time prices |
| GW2Spidy | MAYBE | Guild Wars 2 trade prices. No auth. Unverified. |
| Dota 2 (OpenDota) | MAYBE | Match counts, hero pick rates. API key optional. Unverified. |
| Clash of Clans/Royale | NO | Player stats, not market data |
| Fortnite | NO | Player stats, API key |
| Hypixel | MAYBE | Minecraft server player counts per game mode. API key. Unverified. |
| RAWG.io | NO | Game ratings change too slowly |
| Riot Games | NO | API key, patch-level updates (biweekly) |
| TETR.IO | MAYBE | Tetris player ratings/leaderboards. No auth. Unverified. |
| Eve Online | NO | OAuth required |
| Path of Exile | NO | OAuth required |
| IGDB.com | NO | Game database, static |
| Brawl Stars | NO | Player stats |
| All others (70) | NO | Static game data, card databases, jokes, quizzes, character info |

### Geocoding (86)
| API | Verdict | Reason |
|-----|---------|--------|
| All 86 | NO | IP geolocation, address lookup, map tools — all static reference data |

### Government (86)
| API | Verdict | Reason |
|-----|---------|--------|
| USAspending | **HAVE** | Already integrated |
| FEC | MAYBE | Campaign donation totals by candidate. Seasonal (elections). API key. Unverified. |
| FBI Wanted | NO | List changes weekly at best |
| Deutscher Bundestag DIP | MAYBE | German parliament activity counts. API key. Unverified. |
| Data.parliament.uk | MAYBE | UK parliament petition signatures, bill progress. No auth. Unverified. |
| Census.gov | NO | Annual data |
| US Presidential Election | MAYBE | Electoral vote counts — but only during elections. No auth. Unverified. |
| All others (78) | NO | Static government open data portals, legal databases |

### Health (31)
| API | Verdict | Reason |
|-----|---------|--------|
| Open Disease (disease.sh) | MAYBE | Global disease stats (influenza, etc.). No auth. We have epidemic tracking already. Redundant? Unverified. |
| openFDA | MAYBE | Drug adverse event counts. API key. Slow updates. Unverified. |
| All others (29) | NO | COVID trackers (outdated), nutrition, symptom checkers |

### Jobs (17)
| API | Verdict | Reason |
|-----|---------|--------|
| Adzuna | **HAVE** | Already integrated |
| USAJOBS | MAYBE | Federal job posting counts by agency. API key. Daily updates. Unverified. |
| All others (15) | NO | Job search aggregators, covered by Adzuna |

### Machine Learning (22)
| API | Verdict | Reason |
|-----|---------|--------|
| All 22 | NO | ML/AI tools and services, not data sources |

### Music (33)
| API | Verdict | Reason |
|-----|---------|--------|
| Last.fm | **HAVE** | Already integrated |
| Radio Browser | MAYBE | Internet radio station count by genre, listener counts (if exposed). No auth. Unverified. |
| Spotify | NO | OAuth, not numeric market data |
| Bandsintown/Songkick | NO | Event listings |
| All others (28) | NO | Music players, lyrics, audio tools |

### News (19)
| API | Verdict | Reason |
|-----|---------|--------|
| MarketAux | MAYBE | Stock news with sentiment scores per ticker. API key. Unverified. |
| All others (18) | NO | News aggregators — text content, not numeric data |

### Open Data (35)
| API | Verdict | Reason |
|-----|---------|--------|
| Nasdaq Data Link | **HAVE** | Already integrated |
| Wikipedia | **MAYBE** | `VERIFIED` — daily pageviews, 24-48h delay. Too slow for real-time. |
| Urban Observatory | MAYBE | UK real-time urban sensor data (air quality, traffic, noise). No auth. Unverified. |
| Archive.org | MAYBE | Daily upload counts by media type. No auth. Unverified. |
| Wikidata | NO | Static knowledge base |
| Yelp | NO | OAuth, ratings change slowly |
| All others (28) | NO | Static datasets, directories |

### Open Source Projects (9)
| API | Verdict | Reason |
|-----|---------|--------|
| All 9 | NO | Badges, creative commons, dev tools |

### Patent (4)
| API | Verdict | Reason |
|-----|---------|--------|
| PatentsView | MAYBE | Patent filing counts by technology area. No auth. Weekly updates. Unverified. |
| All others | NO | Patent search tools |

### Personality (23)
| API | Verdict | Reason |
|-----|---------|--------|
| All 23 | NO | Quotes, jokes, horoscopes |

### Phone (5)
| API | Verdict | Reason |
|-----|---------|--------|
| All 5 | NO | Phone validation tools |

### Photography (29)
| API | Verdict | Reason |
|-----|---------|--------|
| All 29 | NO | Image hosting, manipulation, stock photos |

### Programming (5)
| API | Verdict | Reason |
|-----|---------|--------|
| Codeforces | MAYBE | Contest ratings, active users. API key. Periodic. Unverified. |
| KONTESTS | MAYBE | Active programming contest count. No auth. Unverified. |
| All others | NO | Code execution tools |

### Science & Math (33)
| API | Verdict | Reason |
|-----|---------|--------|
| USGS Earthquake | **HAVE** | Already integrated |
| USGS Water | **HAVE** | Already integrated |
| World Bank | **HAVE** | Already integrated |
| Launch Library 2 | MAYBE | Rocket launch countdowns, status changes. No auth. ~20 feeds. Unverified. |
| SpaceX | NO | Overlaps Launch Library, less maintained |
| Purple Air | MAYBE | Hyperlocal PM2.5 sensors. No auth claimed. Unverified. |
| NASA | NO | Mostly imagery, not continuous numeric |
| Open Notify | MAYBE | ISS crew count + position. No auth. We already have ISS tracker though. |
| arXiv | MAYBE | Daily paper submission counts by field. No auth. Daily updates only. Unverified. |
| TLE (satellite) | NO | Orbital parameters, not bet-worthy |
| All others (22) | NO | Math tools, calculators, static science data |

### Security (38)
| API | Verdict | Reason |
|-----|---------|--------|
| Shodan | MAYBE | Internet-connected device counts by type/country. API key. Could be creative feed. Unverified. |
| National Vulnerability Database | MAYBE | New CVE count per day/week. No auth. Unverified. |
| UK Police | NO | Monthly crime data, too slow |
| All others (35) | NO | Security scanning/analysis tools |

### Shopping (14)
| API | Verdict | Reason |
|-----|---------|--------|
| Best Buy | **HAVE** | Already integrated |
| Digi-Key | MAYBE | Electronic component prices + inventory. OAuth. Unverified. |
| All others (12) | NO | E-commerce platforms, OAuth required |

### Social (40)
| API | Verdict | Reason |
|-----|---------|--------|
| 4chan | **HAVE** | Already integrated |
| HackerNews | **HAVE** | Already integrated |
| Reddit | **HAVE** | Already integrated |
| Twitch | **HAVE** | Already integrated |
| Product Hunt | MAYBE | Daily upvote counts on launches. OAuth required though. Unverified. |
| Open Collective | MAYBE | Donation amounts to open-source projects. No auth. Unverified. |
| All others (33) | NO | Social logins, messaging, bots — not data sources |

### Sports & Fitness (33)
| API | Verdict | Reason |
|-----|---------|--------|
| City Bikes | **HAVE** | Already integrated |
| API-FOOTBALL | MAYBE | 800+ football leagues, live stats (possession, shots). **$19/mo min for useful data.** Free tier too limited. Unverified. |
| balldontlie | **PAID** | `VERIFIED` — free tier 5 req/min, game scores only. Player stats $9.99/mo. |
| Sportmonks Cricket | MAYBE | Live cricket. API key, free 100 req/hr. Unverified. |
| Sportmonks Football | MAYBE | Overlaps API-FOOTBALL. Pick one. Unverified. |
| NHL Records and Stats | MAYBE | NHL data. No auth. Unverified. |
| MLB Records and Stats | MAYBE | MLB stats. No auth. Unverified. |
| NBA Stats | MAYBE | NBA stats. No auth. Unverified. |
| Oddsmagnet | MAYBE | UK bookmaker odds history. No auth. Unverified. |
| Cloudbet | MAYBE | Live sports odds. API key. Unverified. |
| OpenLigaDB | MAYBE | German sports leagues. No auth. Unverified. |
| CollegeFootballData.com | MAYBE | US college football. API key. Unverified. |
| Squiggle | MAYBE | Australian Football predictions. No auth. Unverified. |
| Ergast F1 | **DEAD** | `VERIFIED` — DNS dead. Jolpica successor is post-race + non-commercial. |
| TheSportsDB | NO | Crowd-sourced, low update freq |
| Fitbit/Strava/Tredict | NO | Personal fitness, OAuth |
| ApiMedic | NO | Symptom checker |
| Wger | NO | Exercise database |
| All others (11) | NO | Static sports reference, image tools, OAuth fitness |

### Test Data (25)
| API | Verdict | Reason |
|-----|---------|--------|
| All 25 | NO | Fake data generators |

### Text Analysis (15)
| API | Verdict | Reason |
|-----|---------|--------|
| All 15 | NO | NLP/translation tools |

### Tracking (9)
| API | Verdict | Reason |
|-----|---------|--------|
| WhatPulse | MAYBE | Global keyboard/mouse usage stats. No auth. Unverified. |
| All others (8) | NO | Package tracking, affiliate tools |

### Transportation (69)
| API | Verdict | Reason |
|-----|---------|--------|
| ADS-B Exchange | **HAVE** | Already integrated |
| Transport for London | **HAVE** | Already integrated (TfL Tube) |
| Transport for Paris | **HAVE** | Already integrated (Paris Metro) |
| Transport for Germany | **HAVE** | Already integrated (DB Trains) |
| Metro Lisboa | **MAYBE** | `VERIFIED` — 4 lines, status only, no numeric delay |
| Transport for Belgium (iRail) | **YES** | `VERIFIED` — 713 stations, delays in seconds |
| BC Ferries | **MAYBE** | `VERIFIED` — 12 routes, capacity %, community project |
| Tankerkoenig | **BLOCKED** | `VERIFIED` — registration closed |
| Bay Area Rapid Transit (BART) | MAYBE | Predicted arrivals. API key. Unverified. |
| Boston MBTA | MAYBE | Predicted arrivals. API key. Unverified. |
| Transport for Chicago (CTA) | MAYBE | Real-time arrivals. API key. Unverified. |
| Transport for Washington (WMATA) | MAYBE | Metro delays. OAuth. Unverified. |
| Transport for Switzerland (x2) | MAYBE | Swiss train delays. No auth (one endpoint). Unverified. |
| Transport for Netherlands (NS) | MAYBE | Dutch train delays. API key. Unverified. |
| Transport for Norway (Entur) | MAYBE | Norwegian transit. No auth. Unverified. |
| Transport for Sweden (Trafiklab) | MAYBE | Swedish transit. OAuth. Unverified. |
| Transport for Finland (Digitransit) | MAYBE | Finnish transit. No auth. Unverified. |
| Transport for Budapest | MAYBE | Hungarian transit. No auth. Unverified. |
| Transport for Manchester (TfGM) | MAYBE | UK tram/bus delays. API key. Unverified. |
| Railway Transport France (SNCF) | MAYBE | French train data. API key. Unverified. |
| OpenSky Network | NO | Overlaps our ADS-B/flights source |
| AIS Hub | NO | Overlaps our AIS Stream source |
| Schiphol Airport | MAYBE | Amsterdam airport delays. API key. Unverified. |
| Navitia | MAYBE | Multi-country transit. API key. Unverified. |
| TransitLand | MAYBE | Transit aggregator. No auth. Unverified. |
| CTS (Strasbourg) | MAYBE | Strasbourg transit. API key. Unverified. |
| Open Charge Map | NO | Overlaps TomTom EV source |
| transport.rest | MAYBE | Community transit APIs (Berlin VBB, etc). No auth. Unverified. |
| Velib Paris | NO | Overlaps CityBikes |
| Tripadvisor | NO | Ratings change slowly, API key |
| Uber | NO | OAuth, not market data |
| BlaBlaCar | NO | Trip listings, not numeric |
| All others (30) | NO | Routing, hotel bookings, static schedules, or covered cities |

### URL Shorteners (19)
| API | Verdict | Reason |
|-----|---------|--------|
| All 19 | NO | Link shortening tools |

### Vehicle (6)
| API | Verdict | Reason |
|-----|---------|--------|
| Kelley Blue Book | MAYBE | Vehicle price estimates. API key. Unverified. |
| All others (5) | NO | Vehicle specs, telematics |

### Video (43)
| API | Verdict | Reason |
|-----|---------|--------|
| TMDb | **HAVE** | Already integrated |
| Trakt | MAYBE | Movie/TV watching stats. API key. Unverified. |
| All others (41) | NO | Static TV/movie data, quotes, streaming availability |

### Weather (31)
| API | Verdict | Reason |
|-----|---------|--------|
| Open-Meteo | **HAVE** | Already integrated |
| US Weather (NWS) | **HAVE** | Already integrated |
| AQICN | **MIXED** | `VERIFIED` — works but non-commercial license |
| RainViewer | MAYBE | Rain radar data. No auth. Unverified. |
| OpenWeatherMap | NO | API key, paid for useful tiers |
| AccuWeather | NO | Paid |
| Storm Glass | NO | 50 req/day free — too low |
| OpenUV | NO | 50 req/day free — too low |
| Hong Kong Observatory | MAYBE | HK weather + earthquake data. No auth. Unverified. |
| AviationWeather | MAYBE | NOAA aviation weather (METARs, TAFs). No auth. Unverified. |
| All others (20) | NO | Paid, regional duplicates, or covered by Open-Meteo/NWS |

---

## FINAL RANKINGS — Verified sources only

### Tier 1: Add these (verified, high value)

| # | Source | Feeds | Update freq | Auth | Effort |
|---|--------|-------|-------------|------|--------|
| 1 | **RuneScape Grand Exchange** | ~4,500 items | Real-time / 5min | User-Agent only | Medium — batch IDs pattern |
| 2 | **Elexon BMRS (GB grid)** | ~25 (freq Hz, 20 fuel types MW, demand MW) | 15s / 5min / 30min | None | Medium — multiple datasets |
| 3 | **UK Carbon Intensity** | ~20 (national + 17 regions) | 30min | None | Easy — single call fan out |
| 4 | **iRail (Belgian trains)** | ~30 (top stations avg delay) | Real-time | User-Agent only | Easy — same as DB Trains |

### Tier 2: Worth adding (verified, medium value)

| # | Source | Feeds | Update freq | Auth | Effort |
|---|--------|-------|-------------|------|--------|
| 5 | **Lichess** | ~15 (ratings, tournaments) | Minutes-hours | None | Easy |
| 6 | **FFXIV Universalis** | ~200 (top items) | Crowdsourced | None | Medium — need freshness filter |
| 7 | **Metro Lisboa** | 4 | Real-time | None | Trivial |
| 8 | **BC Ferries** | 12 | ~3-5min | None | Easy — community API, no SLA |
| 9 | **OpenAQ v3** | ~100 (intl cities) | Hourly | API key | Medium — adds Delhi/Beijing/London AQI |

### Tier 3: Not now (verified, blocked or paid)

| # | Source | Issue |
|---|--------|-------|
| 10 | Tankerkoenig | Registration closed |
| 11 | balldontlie | Free tier too limited, $9.99/mo for useful data |
| 12 | Ergast/Jolpica F1 | Dead / non-commercial |
| 13 | AQICN | Non-commercial license |
| 14 | Wikipedia pageviews | Daily only, 24-48h delay |

### Stats

| Category | Count |
|----------|-------|
| Total APIs scanned | 1,425 |
| Already have | 29 |
| **YES (verified)** | **4** |
| **MAYBE (verified)** | **5** |
| MAYBE (unverified) | ~60 |
| Blocked/Paid (verified) | 5 |
| NO | ~1,322 |
