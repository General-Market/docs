# AgiArena — Complete Market Types from GitHub Source Code

**Research date:** 2026-02-11
**Source:** github.com/AgiArena (bot, backend, contracts, keeper, frontend repos)
**Method:** Direct source code analysis via GitHub API

---

## Summary

**~150 categories** across **47 unique data sources** in **9 category groups** feeding **150,000+ individual markets**.

---

## 0. MASTER VIEW: 9 Category Groups × 47 Data Sources (from frontend/app/markets/page.tsx)

| # | Group | Icon | Data Sources |
|---|-------|------|-------------|
| 1 | **Finance** | 💹 | stocks, twse (Taiwan), crypto, defi, rates, bonds, ecb, futures, cftc |
| 2 | **Predictions** | 🎯 | polymarket (sports, politics, crypto, entertainment, esports, science, other) |
| 3 | **Economics** | 📊 | bls, worldbank, imf, fred, congress, sec_13f, finra |
| 4 | **Entertainment** | 🎮 | twitch, steam, backpacktf, tmdb, anilist, hackernews, fourchan |
| 5 | **Technology** | 💻 | github, npm, pypi, crates_io, cloudflare |
| 6 | **Environment** | 🌍 | weather, tides, usgs_water, goes_xray |
| 7 | **Energy** | ⚡ | eia, opec, watttime, caiso, energy_charts |
| 8 | **Commodities** | 🛢️ | opec, eia, zillow, bchain |
| 9 | **Transport** | ✈️ | opensky |

### All 47 Data Sources with Display Names

| Source ID | Display Name | Category Group |
|-----------|-------------|----------------|
| `stocks` | US Stocks (Finnhub) | Finance |
| `twse` | Taiwan Stocks | Finance |
| `crypto` | Crypto (CoinGecko) | Finance |
| `defi` | DeFi (DefiLlama) | Finance |
| `rates` | Interest Rates (FRED) | Finance |
| `bonds` | Bond/Treasury | Finance |
| `ecb` | European Central Bank | Finance |
| `futures` | Futures (Nasdaq/CHRIS) | Finance |
| `cftc` | CFTC Positioning | Finance |
| `polymarket` | Prediction Markets | Predictions |
| `bls` | Labor Stats (BLS) | Economics |
| `worldbank` | World Bank | Economics |
| `imf` | IMF Forecasts | Economics |
| `fred` | Federal Reserve (FRED) | Economics |
| `congress` | Congressional Bills | Economics |
| `sec_13f` | SEC 13F Filings | Economics |
| `finra` | FINRA Short Interest | Economics |
| `twitch` | Twitch Live | Entertainment |
| `steam` | Steam Games | Entertainment |
| `backpacktf` | Steam Marketplace | Entertainment |
| `tmdb` | Movies & TV (TMDB) | Entertainment |
| `anilist` | Anime & Manga | Entertainment |
| `hackernews` | Hacker News | Entertainment |
| `fourchan` | 4chan Activity | Entertainment |
| `github` | GitHub Repos | Technology |
| `npm` | npm Packages | Technology |
| `pypi` | PyPI Packages | Technology |
| `crates_io` | Rust Crates | Technology |
| `cloudflare` | Cloudflare Radar | Technology |
| `weather` | Weather (Open-Meteo) | Environment |
| `tides` | NOAA Tides | Environment |
| `usgs_water` | USGS Water | Environment |
| `goes_xray` | Solar X-Ray (GOES) | Environment |
| `eia` | Energy Info Admin (EIA) | Energy |
| `opec` | OPEC | Energy/Commodities |
| `watttime` | Grid Carbon Intensity | Energy |
| `caiso` | CA Energy Grid (CAISO) | Energy |
| `energy_charts` | EU Energy Charts | Energy |
| `zillow` | Zillow Housing | Commodities |
| `bchain` | Bitcoin On-Chain (Nasdaq) | Commodities |
| `opensky` | Aviation Tracking (OpenSky) | Transport |
| `pumpfun` | PumpFun Memecoins | (Finance/Crypto) |

### Polymarket Sub-Feed Types
| Feed Type | Display Name |
|-----------|-------------|
| `poly_sports` | Sports |
| `poly_politics` | Politics & Elections |
| `poly_crypto` | Crypto & Finance |
| `poly_entertainment` | Entertainment & Awards |
| `poly_esports` | Esports & Gaming |
| `poly_science` | Science & Tech |
| `poly_other` | Other |

### Weather/DeFi/Tech Feed Sub-Types
| Feed Type | Display Name |
|-----------|-------------|
| `temperature_2m` | Temperature |
| `rain` | Rainfall |
| `wind_speed_10m` | Wind Speed |
| `pm2_5` | PM2.5 Air Quality |
| `ozone` | Ozone |
| `chain_tvl` | Chain TVL |
| `protocol_tvl` | Protocol TVL |
| `dex_volume` | DEX Volume |
| `streamers` | Live Streamers (Twitch) |
| `games` | Games (Steam) |
| `hn_score` | HN Story Scores |
| `hn_comments` | HN Comment Counts |
| `tmdb_movie` | Movies |
| `tmdb_tv` | TV Shows |
| `cf_http` | HTTP Metrics |
| `cf_iqi` | Internet Quality Index |
| `cf_speed` | Speed Tests |
| `cf_domain` | Domain Rankings |
| `cf_service` | Service Rankings |

---

## 1. Data Sources (from bot/src/constants.ts + backend migrations)

| # | Source ID | Provider | Data Type | Snapshot Freq |
|---|-----------|----------|-----------|---------------|
| 1 | `polymarket` | Polymarket (Gamma API) | Prediction markets (binary outcomes) | Hourly |
| 2 | `coingecko` | CoinGecko | Crypto prices, volume, market cap (~15K assets) | 10min |
| 3 | `pumpfun` | PumpFun | Memecoins | 10min |
| 4 | `stocks` / `finnhub` | Finnhub | US stock prices & volume (~8K+ stocks) | 10min |
| 5 | `openmeteo` | Open-Meteo | Weather data (5K+ cities, 7+ metrics) | 30min |
| 6 | `bls` | Bureau of Labor Statistics | US employment, CPI, PPI, wages | Daily |
| 7 | `rates` / `fred` | Federal Reserve (FRED) | Interest rates, housing, treasury yields | Daily |
| 8 | `ecb` | European Central Bank | EU inflation, rates, money supply, credit | Daily |
| 9 | `defi` / `defillama` | DefiLlama | DeFi TVL, DEX volume, fees, stablecoins, bridges | 10min-Hourly |
| 10 | `eia` | Energy Information Admin | Electricity, oil, gas, coal, renewables (by state/country) | Daily-Weekly |
| 11 | `worldbank` | World Bank | GDP, population, trade, debt, development (200+ countries) | Daily |
| 12 | `futures` | Nasdaq (CHRIS dataset) | Energy, metals, agriculture, indices, currencies, rates futures | Daily |
| 13 | `cftc` | CFTC (via Nasdaq) | COT speculator & commercial positions | Weekly |
| 14 | `bchain` | Nasdaq (BCHAIN) | Bitcoin on-chain metrics | Daily |
| 15 | `opec` | OPEC | Oil basket price | Daily |
| 16 | `imf` | IMF | GDP growth, inflation, unemployment, debt forecasts | Daily |
| 17 | `congress` | US Congress | Congressional bills tracker | Daily |
| 18 | `sec_13f` | SEC EDGAR | 13F fund holdings | Daily |
| 19 | `finra` | FINRA | Short interest & short ratio | Daily |
| 20 | `bonds` | Treasury/bonds | Bond yields, treasury data | Daily |

---

## 2. All Categories (from database migrations)

### A. Core Categories (seed_categories - 9 categories)

| ID | Name | Emoji | Sources | Freq | Ranking |
|----|------|-------|---------|------|---------|
| `all` | All Markets | 🌐 | coingecko, polymarket, pumpfun | daily | volume |
| `crypto` | Crypto | ₿ | coingecko, pumpfun | 10min | market_cap |
| `memecoins` | Memecoins | 🐸 | pumpfun | 10min | market_cap |
| `predictions` | Predictions | 🔮 | polymarket | hourly | volume |
| `politics` | Politics | 🏛️ | polymarket | hourly | volume |
| `sports` | Sports | ⚽ | polymarket | hourly | volume |
| `world` | World Events | 🌍 | polymarket | hourly | relevance |
| `meteo` | Weather | 🌤️ | meteo | daily | population |
| `stocks` | Stocks | 📈 | stocks | 10min | volume |

### B. Source-Based Categories (5 categories)

| ID | Name | Sources |
|----|------|---------|
| `poly-1k` | Polymarket 1K | polymarket |
| `gecko-10k` | CoinGecko 10K | coingecko |
| `poly-all` | All Polymarket | polymarket |
| `gecko-all` | All CoinGecko | coingecko |
| `global-10k` | Global Mix 10K | coingecko, polymarket, pumpfun |

### C. Weather Categories (12 categories)

**All 5K cities (5,000 cities × 5 metrics = 25,000 markets):**
| ID | Name | Metric |
|----|------|--------|
| `all-meteo` | All Weather | Combined |
| `all-temperature` | Temperature | 🌡️ |
| `all-wind` | Wind Speed | 💨 |
| `all-rain` | Rain | 🌧️ |
| `all-pm25` | PM2.5 Air | 😷 |
| `all-ozone` | Ozone | ☀️ |

**Top 200 cities (200 cities × 5 metrics = 1,000 markets):**
| ID | Name | Metric |
|----|------|--------|
| `1k-meteo` | Weather 1K | Combined |
| `1k-temperature` | Temperature 1K | 🌡️ |
| `1k-wind` | Wind 1K | 💨 |
| `1k-rain` | Rain 1K | 🌧️ |
| `1k-pm25` | PM2.5 1K | 😷 |
| `1k-ozone` | Ozone 1K | ☀️ |

### D. Economic Categories (6 categories)

| ID | Name | Sources |
|----|------|---------|
| `employment` | Employment | bls, ecb |
| `inflation` | Inflation | bls, ecb |
| `interest_rates` | Interest Rates | rates, ecb |
| `money_supply` | Money Supply | ecb |
| `credit` | Credit & Lending | ecb |
| `macro` | Macro Indicators | bls, ecb |

### E. Theme Categories (117 categories - Story 13-2)

#### Crypto Themes (4)
- `crypto-prices-10k` — Crypto Prices 10K ₿
- `crypto-volume-10k` — Crypto Volume 10K 📊
- `crypto-mcap-10k` — Crypto Market Cap 10K 💰
- `crypto-exchanges-all` — Crypto Exchanges 🏦

#### DeFi Themes (9)
- `defi-protocols-tvl-all` — DeFi Protocols TVL 🔗
- `defi-chains-tvl-all` — DeFi Chains TVL ⛓️
- `dex-volume-all` — DEX Volume 🔄
- `protocol-fees-all` — Protocol Fees 💸
- `protocol-revenue-all` — Protocol Revenue 💵
- `stablecoins-mcap-all` — Stablecoins Market Cap 🪙
- `stablecoins-volume-all` — Stablecoins Volume 🪙
- `bridges-tvl-all` — Bridges TVL 🌉
- `bridges-volume-all` — Bridges Volume 🌉

#### US Stocks Themes (2)
- `stocks-us-price-all` — US Stock Prices 📈
- `stocks-us-volume-all` — US Stock Volume 📉

#### Short Interest Themes (2)
- `short-interest-all` — Short Interest 🩳
- `short-ratio-all` — Short Ratio 📐

#### Weather Themes (7)
- `temperature-cities-10k` — Temperature Cities 10K 🌡️
- `humidity-cities-10k` — Humidity Cities 10K 💧
- `wind-speed-cities-10k` — Wind Speed Cities 10K 💨
- `precipitation-cities-10k` — Precipitation Cities 10K 🌧️
- `pressure-cities-10k` — Pressure Cities 10K 🌀
- `uv-index-cities-10k` — UV Index Cities 10K ☀️
- `air-quality-cities-10k` — Air Quality Cities 10K 🏭

#### Electricity Themes (8)
- `electricity-generation-states-all` — Electricity Generation by State ⚡
- `electricity-price-states-all` — Electricity Price by State 💡
- `electricity-solar-states-all` — Solar Generation by State ☀️
- `electricity-wind-states-all` — Wind Generation by State 💨
- `electricity-nuclear-states-all` — Nuclear Generation by State ☢️
- `electricity-coal-states-all` — Coal Generation by State 🪨
- `electricity-natgas-states-all` — Natural Gas Generation by State 🔥
- `electricity-hydro-states-all` — Hydro Generation by State 🌊

#### Oil & Gas Themes (10)
- `oil-production-countries-all` — Oil Production by Country 🛢️
- `oil-consumption-countries-all` — Oil Consumption by Country 🛢️
- `oil-reserves-countries-all` — Oil Reserves by Country 🛢️
- `oil-exports-countries-all` — Oil Exports by Country 🚢
- `oil-imports-countries-all` — Oil Imports by Country 🚢
- `natgas-production-countries-all` — Natural Gas Production 🔥
- `natgas-consumption-countries-all` — Natural Gas Consumption 🔥
- `gasoline-price-states-all` — Gasoline Prices by State ⛽
- `crude-stocks-padd-all` — Crude Stocks by PADD 🛢️
- `refinery-utilization-padd-all` — Refinery Utilization by PADD 🏭

#### Coal & Renewables Themes (4)
- `coal-production-states-all` — Coal Production by State 🪨
- `coal-consumption-states-all` — Coal Consumption by State 🪨
- `renewable-capacity-states-all` — Renewable Capacity by State 🌿
- `renewable-generation-states-all` — Renewable Generation by State 🌿

#### GDP & Economy Themes (4)
- `gdp-nominal-countries-all` — GDP Nominal by Country 💰
- `gdp-growth-countries-all` — GDP Growth by Country 📈
- `gdp-per-capita-countries-all` — GDP Per Capita by Country 👤
- `gni-countries-all` — GNI by Country 💰

#### Population & Demographics Themes (5)
- `population-countries-all` — Population by Country 👥
- `population-growth-countries-all` — Population Growth by Country 📈
- `urbanization-countries-all` — Urbanization by Country 🏙️
- `life-expectancy-countries-all` — Life Expectancy by Country ❤️
- `fertility-rate-countries-all` — Fertility Rate by Country 👶

#### Trade Themes (7)
- `exports-countries-all` — Exports by Country 📦
- `imports-countries-all` — Imports by Country 📥
- `trade-balance-countries-all` — Trade Balance by Country ⚖️
- `current-account-countries-all` — Current Account by Country 📊
- `fdi-inflow-countries-all` — FDI Inflows by Country 💹
- `fdi-outflow-countries-all` — FDI Outflows by Country 💹
- `remittances-countries-all` — Remittances by Country 💸

#### Government & Debt Themes (5)
- `debt-to-gdp-countries-all` — Debt-to-GDP by Country 🏛️
- `budget-balance-countries-all` — Budget Balance by Country 📋
- `tax-revenue-countries-all` — Tax Revenue by Country 🏦
- `govt-spending-countries-all` — Government Spending by Country 🏛️
- `military-spending-countries-all` — Military Spending by Country 🎖️

#### Inflation & Prices Themes (5)
- `inflation-countries-all` — Inflation by Country 📈
- `cpi-components-all` — CPI Components (US) 🏷️
- `ppi-industries-all` — PPI by Industry (US) 🏭
- `import-prices-all` — Import Prices by Category 📥
- `export-prices-all` — Export Prices by Category 📦

#### Employment Themes (6)
- `unemployment-countries-all` — Unemployment by Country 📉
- `employment-states-all` — Employment by US State 💼
- `employment-sectors-all` — Employment by US Sector 🏢
- `wages-industries-all` — Wages by Industry (US) 💵
- `labor-force-countries-all` — Labor Force by Country 👷
- `jobless-claims-states-all` — Jobless Claims by State 📋

#### Housing Themes (6)
- `home-prices-metros-all` — Home Prices by Metro 🏠
- `home-prices-states-all` — Home Prices by State 🏡
- `rents-metros-all` — Rents by Metro 🏘️
- `rents-states-all` — Rents by State 🏘️
- `building-permits-states-all` — Building Permits by State 🔨
- `home-sales-states-all` — Home Sales by State 🏠

#### Interest Rates Themes (5)
- `treasury-yields-all` — Treasury Yields 🏛️
- `central-bank-rates-all` — Central Bank Rates 🏦
- `mortgage-rates-all` — Mortgage Rates 🏠
- `corporate-spreads-all` — Corporate Spreads 📊
- `libor-sofr-all` — LIBOR/SOFR Rates 📈

#### Futures Themes (6)
- `futures-energy-all` — Energy Futures 🛢️
- `futures-metals-all` — Metal Futures 🥇
- `futures-agriculture-all` — Agriculture Futures 🌾
- `futures-indices-all` — Index Futures 📊
- `futures-currencies-all` — Currency Futures 💱
- `futures-rates-all` — Rate Futures 📈

#### Positioning Themes (2)
- `cot-spec-net-all` — COT Speculator Net Positions 🎯
- `cot-commercial-net-all` — COT Commercial Net Positions 🏭

#### Bitcoin On-Chain (1)
- `bitcoin-onchain-all` — Bitcoin On-Chain Metrics ⛓️

#### Development Indicators (11)
- `health-spending-countries-all` — Health Spending by Country 🏥
- `education-spending-countries-all` — Education Spending by Country 🎓
- `internet-users-countries-all` — Internet Users by Country 🌐
- `mobile-subscriptions-countries-all` — Mobile Subscriptions by Country 📱
- `electricity-access-countries-all` — Electricity Access by Country ⚡
- `co2-emissions-countries-all` — CO2 Emissions by Country 🌍
- `forest-area-countries-all` — Forest Area by Country 🌲
- `renewable-energy-countries-all` — Renewable Energy by Country 🌿
- `research-spending-countries-all` — R&D Spending by Country 🔬
- `high-tech-exports-countries-all` — High-Tech Exports by Country 🖥️
- `tourism-arrivals-countries-all` — Tourism Arrivals by Country ✈️

#### Energy Macro + Regulatory (7)
- `opec-basket-price` — OPEC Basket Price 🛢️
- `imf-gdp-growth-all` — IMF GDP Growth Forecasts 📊
- `imf-inflation-all` — IMF Inflation Forecasts 📈
- `imf-unemployment-all` — IMF Unemployment Forecasts 👷
- `imf-debt-all` — IMF Government Debt 🏛️
- `congress-bills-all` — Congressional Bills Tracker 🏛️
- `sec-13f-holdings-all` — SEC 13F Fund Holdings 📑

---

## 3. Market Count Estimation

| Data Source | Est. Markets | How |
|-------------|-------------|-----|
| Polymarket | ~25,000 | Binary outcome markets |
| CoinGecko | ~15,000 | Crypto assets by price/volume/mcap |
| PumpFun | ~5,000+ | Memecoins |
| Finnhub (US Stocks) | ~8,000 | NYSE + NASDAQ |
| Open-Meteo | ~35,000+ | 5K cities × 7 metrics |
| World Bank | ~10,000+ | 200+ countries × 50+ indicators |
| DefiLlama | ~5,000+ | Protocols, chains, DEXes, stablecoins, bridges |
| EIA | ~5,000+ | 50 states × energy types + countries |
| BLS | ~5,000+ | Employment, CPI, PPI across sectors/states |
| FRED/Treasury | ~2,000+ | Rates, housing, yields |
| ECB | ~1,000+ | EU monetary data |
| FINRA | ~3,000+ | Short interest per stock |
| Futures (Nasdaq) | ~500+ | Commodity/index/currency futures |
| CFTC | ~200+ | COT report positions |
| Bitcoin On-Chain | ~50+ | Hash rate, tx volume, etc. |
| World Bank dev | ~2,000+ | Development indicators |
| IMF | ~1,000+ | Forecasts per country |
| OPEC | ~50+ | Oil basket, production |
| Congress | ~500+ | Active bills |
| SEC 13F | ~5,000+ | Fund holdings |
| **TOTAL** | **~128,000-160,000** | **150K+** |

---

## 4. Bot Trading Architecture

### Trade Resolution: "Majority Wins"
- Agent selects N markets from a category snapshot
- Takes LONG/SHORT (crypto/stocks) or YES/NO (polymarket) positions
- Two agents matched P2P with opposing worldviews
- Resolution: whoever got >50% of individual trades right wins the full stake
- 0.1% fee on winning positions only

### Trade List Sizes
- `1K` — 1,000 markets
- `10K` — 10,000 markets
- `100K` — 100,000 markets
- `ALL` — Every market in the category

### Risk Profiles
- **Conservative** (2% per bet, 0.85x odds) — cautious
- **Balanced** (5% per bet, 1.0x odds) — fair
- **Aggressive** (10% per bet, 1.15x odds) — risk-seeking

### Horizons
- Short (5 min), Daily (24h), Weekly, Monthly, Quarterly

### Bitmap Compression
Positions compressed from ~800KB to ~1.7KB for 10K trades using bitmap encoding for on-chain commitment.

---

## 5. Key Technical Details

### Market ID Format
`{source}:{resolution}:{rawId}` — e.g., `polymarket:keeper:0x123`, `coingecko:deterministic:bitcoin`

### Resolution Types
- **Keeper resolution** — Polymarket markets (human/oracle resolved)
- **Deterministic resolution** — Price-based (crypto, stocks, weather) — resolved by comparing entry vs. exit price

### Data Node Architecture
- Authenticated API with EIP-712 signed requests
- Endpoint pattern: `/api/v1/prices/{source}/{assetId}`
- Public snapshot access (unauthenticated) combining all sources
- Merkle tree generation for trade verification

### Negotiation Engine
- **ACCEPT** — price within 0.5% of fair value
- **COUNTER** — within 2%, negotiate closer
- **SWITCH** — within 5%, abandon own offer for better fill
- **IGNORE** — >5% difference, too far
