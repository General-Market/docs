/**
 * Vision source registry.
 * Maps each data-node source to display metadata for the sources grid.
 */

export type SourceCategory =
  | 'finance'
  | 'economic'
  | 'regulatory'
  | 'tech'
  | 'academic'
  | 'entertainment'
  | 'geophysical'
  | 'transport'
  | 'nature'
  | 'space'

export interface VisionSource {
  id: string
  name: string
  description: string
  category: SourceCategory
  logo: string
  brandBg: string
  /** Market ID prefixes that belong to this source (for filtering snapshot data) */
  prefixes: string[]
}

/**
 * All 79 data sources mapped from data-node/src/market_data/sources/.
 * Some data-node dirs are sub-sources grouped under one card (e.g. sec_edgar + sec_efts + sec_insider → SEC).
 */
export const VISION_SOURCES: VisionSource[] = [
  // ── Finance ──
  { id: 'coingecko', name: 'CoinGecko Crypto', description: 'Cryptocurrency market data — prices, volumes, market caps for thousands of tokens.', category: 'finance', logo: '/source-imgs/new-coingecko.png', brandBg: '#f5f5f5', prefixes: ['crypto_'] },
  { id: 'pumpfun', name: 'Pump.fun Tokens', description: 'Solana memecoin launchpad — real-time prices, volumes, and market caps for recently launched tokens.', category: 'finance', logo: '/source-imgs/new-pumpfun.png', brandBg: 'linear-gradient(135deg,#00d18c,#1a1a2e)', prefixes: ['pumpfun_'] },
  { id: 'defillama', name: 'DefiLlama DeFi', description: 'DeFi protocol analytics — TVL, yields, fees, volumes across all major chains and protocols.', category: 'finance', logo: '/source-imgs/new-defillama.png', brandBg: '#1b1b1b', prefixes: ['defi_'] },
  { id: 'finnhub', name: 'Finnhub Stocks', description: 'Real-time stock market data — US equities, forex, and crypto with company fundamentals.', category: 'finance', logo: '/source-imgs/new-finnhub.png', brandBg: '#000000', prefixes: ['stock_', 'stocks_'] },
  { id: 'nasdaq', name: 'Nasdaq Listings', description: 'Official Nasdaq exchange data — listed securities, ETFs, and index constituents.', category: 'finance', logo: '/source-imgs/new-nasdaq.svg', brandBg: '#f5f5f5', prefixes: ['nasdaq_'] },
  { id: 'zillow', name: 'Zillow Real Estate', description: 'US housing market data — home values, rent indices, inventory, and price-to-rent ratios.', category: 'finance', logo: '/source-imgs/zillow.svg', brandBg: '#1b1b1b', prefixes: ['zillow_'] },
  { id: 'polymarket', name: 'Polymarket Predictions', description: 'Prediction market data — real-time odds and volumes for events across politics, crypto, sports.', category: 'finance', logo: '/source-imgs/new-polymarket.png', brandBg: '#1b1b1b', prefixes: ['poly_'] },
  { id: 'finra', name: 'FINRA Short Interest', description: 'Short selling data — daily short volume and total volume for all US exchange-listed securities.', category: 'finance', logo: '/source-imgs/finra.svg', brandBg: '#e8edf4', prefixes: ['finra_'] },
  { id: 'finra_short_vol', name: 'FINRA Short Volume', description: 'Daily short volume and total volume for exchange-listed securities from FINRA reports.', category: 'finance', logo: '/source-imgs/finra.svg', brandBg: '#e8edf4', prefixes: ['finra_short_vol_'] },
  { id: 'futures', name: 'Continuous Futures', description: 'Continuous front-month futures contracts — commodities, indices, currencies, and interest rates.', category: 'finance', logo: '/source-imgs/new-fred.png', brandBg: '#f5f5f5', prefixes: ['futures_'] },
  { id: 'bchain', name: 'Bitcoin On-Chain', description: 'Bitcoin blockchain metrics — hashrate, difficulty, block size, miner revenue, transaction volume.', category: 'finance', logo: '/source-imgs/new-bitcoin.png', brandBg: '#f5f5f5', prefixes: ['bchain_'] },
  { id: 'yahoo_drinks', name: 'Yahoo Drinks', description: 'Coffee, sugar, cocoa, OJ futures and major beverage company stock prices via Yahoo Finance.', category: 'finance', logo: '/source-imgs/new-yahoodrinks.png', brandBg: '#f5f5f5', prefixes: ['yahoo_drinks_'] },
  { id: 'twse', name: 'Taiwan Stock Exchange', description: 'TWSE market data — daily OHLCV, foreign investor flows, margin trading for Taiwanese equities.', category: 'finance', logo: '/source-imgs/new-twse.svg', brandBg: '#f5f5f5', prefixes: ['twse_'] },
  { id: 'bestbuy', name: 'Best Buy Products', description: 'Consumer electronics pricing — real-time sale prices across 7 categories from top-selling products.', category: 'finance', logo: '/source-imgs/new-bestbuy.png', brandBg: '#f5f5f5', prefixes: ['bestbuy_'] },

  // ── Economic ──
  { id: 'fred', name: 'FRED Interest Rates', description: 'Federal Reserve Economic Data — interest rates, yield curves, money supply, employment, inflation.', category: 'economic', logo: '/source-imgs/new-fred.png', brandBg: '#f5f5f5', prefixes: ['fred_'] },
  { id: 'eia', name: 'EIA Energy Data', description: 'Energy Information Administration — crude oil, natural gas, electricity, renewable energy.', category: 'economic', logo: '/source-imgs/new-eia.png', brandBg: '#00526e', prefixes: ['eia_'] },
  { id: 'treasury', name: 'US Treasury Yields', description: 'Daily yield curve rates — T-bills, notes, and bonds from 1-month to 30-year maturities.', category: 'economic', logo: '/source-imgs/new-treasury.svg', brandBg: '#0057b7', prefixes: ['treasury_', 'tsy_'] },
  { id: 'ecb', name: 'ECB Exchange Rates', description: 'European Central Bank — exchange rates, monetary aggregates, bank lending, euro area indicators.', category: 'economic', logo: '/source-imgs/new-ecb.svg', brandBg: '#f0f2f5', prefixes: ['ecb_'] },
  { id: 'worldbank', name: 'World Bank Indicators', description: 'Development indicators — GDP, population, poverty, health, education for 200+ countries.', category: 'economic', logo: '/source-imgs/new-worldbank.svg', brandBg: '#f5f5f5', prefixes: ['worldbank_'] },
  { id: 'bls', name: 'Bureau of Labor Stats', description: 'Bureau of Labor Statistics — CPI, unemployment, job openings, producer prices, wage data.', category: 'economic', logo: '/source-imgs/new-bls.svg', brandBg: '#f5f5f5', prefixes: ['bls_'] },
  { id: 'adzuna', name: 'Adzuna Jobs', description: 'Job vacancy counts and average advertised salaries across US, UK, Germany, and France.', category: 'economic', logo: '/source-imgs/new-adzuna.png', brandBg: '#f5f5f5', prefixes: ['adzuna_'] },
  { id: 'usa_spending', name: 'Federal Spending', description: 'Federal spending — contracts, grants, loans, and government outlays by agency and program.', category: 'economic', logo: '/source-imgs/usaspending.png', brandBg: '#f5f5f5', prefixes: ['usa_spending_'] },
  { id: 'imf', name: 'IMF Indicators', description: 'International Monetary Fund — GDP, trade, debt, reserves, and fiscal indicators for 190+ countries.', category: 'economic', logo: '/source-imgs/new-imf.svg', brandBg: '#002244', prefixes: ['imf_'] },
  { id: 'opec', name: 'OPEC Oil Data', description: 'OPEC reference basket price and production data for global oil market analysis.', category: 'economic', logo: '/source-imgs/new-eia.png', brandBg: '#005fa3', prefixes: ['opec_'] },
  { id: 'cftc', name: 'CFTC Commitments', description: 'Commitments of Traders — weekly positions of commercial and speculative traders in futures markets.', category: 'economic', logo: '/source-imgs/new-fred.png', brandBg: '#f5f5f5', prefixes: ['cftc_'] },

  // ── Regulatory ──
  { id: 'sec', name: 'SEC Filings', description: 'Institutional investment disclosures — 13F holdings, EDGAR filings, and insider transactions.', category: 'regulatory', logo: '/source-imgs/new-sec.svg', brandBg: '#0a3055', prefixes: ['sec_edgar_', 'sec_efts_', 'sec_insider_'] },
  { id: 'congress', name: 'Congress Votes', description: 'US legislative data — bill introductions, votes, committee actions, congressional metrics.', category: 'regulatory', logo: '/source-imgs/congress.png', brandBg: 'linear-gradient(135deg,#1a2744,#2d4a7a)', prefixes: ['congress_'] },
  { id: 'courtlistener', name: 'Federal Courts', description: 'Daily federal court filing counts — opinions, docket entries, and new cases across 34 courts.', category: 'regulatory', logo: '/source-imgs/new-courtlistener.png', brandBg: '#f5f5f5', prefixes: ['court_'] },

  // ── Tech & Dev ──
  { id: 'github', name: 'GitHub Repositories', description: 'Open source activity — stars, forks, issues, commits, and contributor metrics.', category: 'tech', logo: '/source-imgs/new-github.png', brandBg: '#24292e', prefixes: ['github_'] },
  { id: 'npm', name: 'npm Packages', description: 'JavaScript ecosystem — daily/weekly download counts and framework adoption trends.', category: 'tech', logo: '/source-imgs/new-npm.png', brandBg: '#f5f5f5', prefixes: ['npm_'] },
  { id: 'pypi', name: 'PyPI Packages', description: 'Python package index — download statistics, version releases, and adoption metrics.', category: 'tech', logo: '/source-imgs/new-pypi.svg', brandBg: '#006dad', prefixes: ['pypi_'] },
  { id: 'crates_io', name: 'Crates.io Rust', description: 'Rust ecosystem — crate downloads, versions, and dependency metrics.', category: 'tech', logo: '/source-imgs/new-cratesio.png', brandBg: '#173d13', prefixes: ['crates_io_'] },
  { id: 'stackexchange', name: 'StackOverflow', description: 'Developer activity — daily new question counts by popular tag tracking framework and language adoption.', category: 'tech', logo: '/source-imgs/new-stackoverflow.png', brandBg: '#f5f5f5', prefixes: ['stackexchange_'] },
  { id: 'hackernews', name: 'Hacker News', description: 'Tech community pulse — top stories, trending topics, engagement from Y Combinator\'s forum.', category: 'tech', logo: '/source-imgs/new-hackernews.svg', brandBg: '#f66a0a', prefixes: ['hn_'] },
  { id: 'cloudflare', name: 'Cloudflare DNS', description: 'Internet traffic insights — domain popularity, traffic trends, and attack analytics.', category: 'tech', logo: '/source-imgs/new-cloudflare.svg', brandBg: '#f5f5f5', prefixes: ['cloudflare_'] },

  // ── Academic ──
  { id: 'openalex', name: 'OpenAlex Papers', description: 'Scholarly work tracker — daily new publication counts by research field across 25 academic disciplines.', category: 'academic', logo: '/source-imgs/new-openalex.png', brandBg: '#f5f5f5', prefixes: ['openalex_'] },
  { id: 'crossref', name: 'Crossref Citations', description: 'Scholarly publishing — daily new DOI registrations by document type tracking research output trends.', category: 'academic', logo: '/source-imgs/new-crossref.png', brandBg: '#f5f5f5', prefixes: ['crossref_'] },
  { id: 'pubmed', name: 'PubMed Medical', description: 'NCBI biomedical literature — daily new article counts by topic across 24 medical research areas.', category: 'academic', logo: '/source-imgs/new-pubmed.png', brandBg: '#f5f5f5', prefixes: ['pubmed_'] },

  // ── Entertainment ──
  { id: 'twitch', name: 'Twitch Streaming', description: 'Live streaming metrics — viewer counts, active streams, top categories, channel growth.', category: 'entertainment', logo: '/source-imgs/new-twitch.png', brandBg: '#9146FF', prefixes: ['twitch_'] },
  { id: 'tmdb', name: 'Movies & TV', description: 'Film and television — box office, ratings, popularity scores, and trending titles.', category: 'entertainment', logo: '/source-imgs/new-tmdb.svg', brandBg: '#032551', prefixes: ['tmdb_'] },
  { id: 'lastfm', name: 'Last.fm Music', description: 'Music analytics — top artist listener counts, playcounts, and chart trends from Last.fm.', category: 'entertainment', logo: '/source-imgs/new-lastfm.png', brandBg: '#f5f5f5', prefixes: ['lastfm_'] },
  { id: 'steam', name: 'Steam Gaming', description: 'PC gaming — concurrent players, game releases, review scores, and player count trends.', category: 'entertainment', logo: '/source-imgs/new-steam.png', brandBg: '#171a21', prefixes: ['steam_'] },
  { id: 'anilist', name: 'AniList Anime', description: 'Anime and manga — popularity, ratings, seasonal rankings, community engagement.', category: 'entertainment', logo: '/source-imgs/new-anilist.png', brandBg: '#152232', prefixes: ['anilist_'] },
  { id: 'reddit', name: 'Reddit Communities', description: 'Community analytics — subscriber counts and active users across 100+ curated subreddits.', category: 'entertainment', logo: '/source-imgs/new-reddit.png', brandBg: '#1a1a2e', prefixes: ['reddit_'] },
  { id: 'chaturbate', name: 'Chaturbate Live', description: 'Adult streaming metrics — live viewer counts for top models from the public affiliate API.', category: 'entertainment', logo: '/source-imgs/new-chaturbate.png', brandBg: '#f5f5f5', prefixes: ['cb_model_'] },
  { id: 'bgg', name: 'Board Games', description: 'Board game trends — hotness rankings for top 50 board games from the BGG community.', category: 'entertainment', logo: '/source-imgs/new-bgg.png', brandBg: '#f5f5f5', prefixes: ['bgg_'] },
  { id: 'backpacktf', name: 'Backpack.tf Trading', description: 'TF2 economy — item prices, unusual hat values, and virtual item trading volume.', category: 'entertainment', logo: '/source-imgs/new-backpacktf.png', brandBg: '#363636', prefixes: ['backpacktf_'] },
  { id: 'fourchan', name: '4chan Boards', description: 'Imageboard sentiment — post volumes, trending topics across /biz/, /pol/, and more.', category: 'entertainment', logo: '/source-imgs/fourchan.png', brandBg: 'linear-gradient(135deg,#6b8e6b,#3d5c3d)', prefixes: ['fourchan_'] },
  { id: 'sports', name: 'Sports Stats', description: 'Live sports data — scores, standings, schedules, stats across NFL, NBA, MLB, NHL.', category: 'entertainment', logo: '/source-imgs/new-espn.svg', brandBg: '#1b1b1b', prefixes: ['sport_'] },
  { id: 'pandascore', name: 'Esports', description: 'Esports match tracking — live scores across CS2, LoL, Dota 2, Valorant, and more.', category: 'entertainment', logo: '/source-imgs/new-pandascore.png', brandBg: '#f5f5f5', prefixes: ['esport_'] },
  { id: 'queue_times', name: 'Theme Park Waits', description: 'Average ride wait times across 30+ major theme parks worldwide — Disney, Universal, and more.', category: 'entertainment', logo: '/source-imgs/new-queuetimes.png', brandBg: '#1a1a2e', prefixes: ['queue_times_'] },

  // ── Geophysical ──
  { id: 'earthquake', name: 'USGS Earthquakes', description: 'Seismic event data — real-time magnitudes, depths, and locations from the seismic network.', category: 'geophysical', logo: '/source-imgs/new-usgs.svg', brandBg: '#f5f5f5', prefixes: ['earthquake_'] },
  { id: 'volcano', name: 'Volcano Activity', description: 'Volcanic activity monitoring — alert levels, eruption status, hazard assessments worldwide.', category: 'geophysical', logo: '/source-imgs/new-volcano.png', brandBg: '#c0cfe0', prefixes: ['volcano_'] },
  { id: 'weather', name: 'NOAA Weather', description: 'Official NWS forecasts — point forecasts, area discussions, and observation data across the US.', category: 'geophysical', logo: '/source-imgs/new-noaa.png', brandBg: '#f5f5f5', prefixes: ['weather_'] },
  { id: 'weather_alerts', name: 'Weather Alerts', description: 'National Weather Service — warnings, watches, advisories for severe weather across the US.', category: 'geophysical', logo: '/source-imgs/new-nws.svg', brandBg: '#FFF3E0', prefixes: ['weather_alert_'] },
  { id: 'openmeteo', name: 'Open-Meteo', description: 'Global weather forecasts — temperature, precipitation, wind, and historical climate data.', category: 'geophysical', logo: '/source-imgs/new-openmeteo.png', brandBg: '#f5f5f5', prefixes: ['openmeteo_'] },
  { id: 'airnow', name: 'Air Quality', description: 'EPA air quality index — real-time AQI readings across 300+ US metropolitan reporting areas.', category: 'geophysical', logo: '/source-imgs/new-airnow.png', brandBg: '#f5f5f5', prefixes: ['airnow_'] },
  { id: 'usgs_water', name: 'USGS Water', description: 'River discharge monitoring — real-time streamflow data from USGS stations across 15 US states.', category: 'geophysical', logo: '/source-imgs/new-usgswater.png', brandBg: '#f5f5f5', prefixes: ['usgs_water_'] },
  { id: 'noaa_met', name: 'NOAA Ocean Met', description: 'Water temperature and wind speed from 59 major US coastal meteorological stations.', category: 'geophysical', logo: '/source-imgs/new-noaamet.png', brandBg: '#f5f5f5', prefixes: ['noaa_met_'] },
  { id: 'noaa_tides', name: 'NOAA Tides', description: 'Real-time water levels from 59 major US tide stations relative to MLLW datum.', category: 'geophysical', logo: '/source-imgs/new-noaatides.png', brandBg: '#f5f5f5', prefixes: ['noaa_tide_'] },
  { id: 'ndbc', name: 'NDBC Ocean Buoys', description: 'Wave height and ocean conditions from NDBC buoys across US coastal and offshore waters.', category: 'geophysical', logo: '/source-imgs/new-ndbc.png', brandBg: '#f5f5f5', prefixes: ['ndbc_'] },
  { id: 'nwps', name: 'River Gauges', description: 'Real-time river gauge heights and flood stage data from 68 major US waterway monitoring points.', category: 'geophysical', logo: '/source-imgs/new-nwps.png', brandBg: '#f5f5f5', prefixes: ['nwps_'] },
  { id: 'nrc_nuclear', name: 'NRC Nuclear', description: 'Daily power output percentage for all 93 US commercial nuclear reactors from NRC reports.', category: 'geophysical', logo: '/source-imgs/new-nrcnuclear.png', brandBg: '#f5f5f5', prefixes: ['nrc_'] },
  { id: 'wildfire', name: 'Wildfire Tracking', description: 'Satellite fire detection — real-time active fire data from MODIS and VIIRS instruments.', category: 'geophysical', logo: '/source-imgs/new-firms.png', brandBg: '#2d1810', prefixes: ['wildfire_'] },
  { id: 'epidemic', name: 'Disease Tracking', description: 'Global disease tracking — case counts, deaths, vaccination rates by country.', category: 'geophysical', logo: '/source-imgs/new-diseasesh.png', brandBg: '#1b1b1b', prefixes: ['epidemic_'] },

  // ── Transport ──
  { id: 'flights', name: 'Global Flights', description: 'Aviation tracking — live flight counts, airport traffic, airline ops, airspace congestion.', category: 'transport', logo: '/source-imgs/new-flights.png', brandBg: '#2a2a2a', prefixes: ['flights_'] },
  { id: 'gtfs_rt', name: 'Transit Realtime', description: 'Public transit feeds — real-time bus/rail positions, service alerts, schedule adherence.', category: 'transport', logo: '/source-imgs/new-transitland2.svg', brandBg: '#f0f2f5', prefixes: ['gtfs_'] },
  { id: 'citybikes', name: 'CityBikes', description: 'Available bikes across 30 major bike-sharing networks worldwide — real-time station data.', category: 'transport', logo: '/source-imgs/new-citybikes.svg', brandBg: 'linear-gradient(135deg,#ffb800,#f59e00)', prefixes: ['citybikes_'] },
  { id: 'parking', name: 'Parking Availability', description: 'Real-time free parking space counts across 20+ European cities from municipal sensors.', category: 'transport', logo: '/source-imgs/new-parkapi.png', brandBg: 'linear-gradient(135deg,#e8eaf6,#c5cae9)', prefixes: ['parking_'] },
  { id: 'tomtom_traffic', name: 'TomTom Traffic', description: 'Real-time road congestion ratios for 20+ highway corridors — current speed vs free-flow speed.', category: 'transport', logo: '/source-imgs/new-tomtomtraffic.png', brandBg: '#f5f5f5', prefixes: ['tomtom_traffic_'] },
  { id: 'tomtom_evcharge', name: 'EV Charging', description: 'Available EV charging connectors at 25+ major charging hubs worldwide — real-time availability.', category: 'transport', logo: '/source-imgs/new-tomtomev.png', brandBg: '#f5f5f5', prefixes: ['tomtom_evcharge_'] },
  { id: 'cbp_border', name: 'Border Wait Times', description: 'US Customs and Border Protection — real-time passenger and commercial wait times at all ports of entry.', category: 'transport', logo: '/source-imgs/new-cbpborder.png', brandBg: '#1a2744', prefixes: ['cbp_border_'] },
  { id: 'faa_delays', name: 'Airport Delays', description: 'Real-time delay status for 30 major US airports from the FAA Airport Status Web Service.', category: 'transport', logo: '/source-imgs/new-faadelays.png', brandBg: '#f5f5f5', prefixes: ['faa_delays_'] },
  { id: 'aisstream', name: 'Ship Tracking', description: 'Real-time AIS stream — live vessel positions, speeds, and routes from AIS receivers.', category: 'transport', logo: '/source-imgs/new-aisstream.png', brandBg: '#1b1b1b', prefixes: ['aisstream_'] },
  { id: 'maritime', name: 'Port Data', description: 'Ship tracking — vessel positions, port traffic, shipping lane activity, cargo movements.', category: 'transport', logo: '/source-imgs/new-marinetraffic.png', brandBg: '#1b1b1b', prefixes: ['maritime_'] },

  // ── Nature ──
  { id: 'ebird', name: 'eBird Observations', description: 'Global birding data — species checklists, hotspot activity, migration timing from Cornell Lab.', category: 'nature', logo: '/source-imgs/new-ebird.svg', brandBg: '#f5f5f5', prefixes: ['ebird_'] },
  { id: 'animals', name: 'Wildlife Tracking', description: 'Citizen science biodiversity — species sightings, observation counts, ecological trends.', category: 'nature', logo: '/source-imgs/new-inaturalist.svg', brandBg: '#f5f5f5', prefixes: ['animals_'] },
  { id: 'movebank', name: 'Animal Migration', description: 'Animal movement tracking — GPS telemetry for wildlife migration studies worldwide.', category: 'nature', logo: '/source-imgs/movebank.png', brandBg: '#e8f0e8', prefixes: ['movebank_'] },
  { id: 'shelter', name: 'Animal Shelters', description: 'Stray animal counts at shelters by species and status — dogs and cats via Socrata open data.', category: 'nature', logo: '/source-imgs/new-shelter.png', brandBg: '#f5f5f5', prefixes: ['shelter_'] },

  // ── Space ──
  { id: 'spaceweather', name: 'Space Weather', description: 'Solar activity — solar flares, geomagnetic storms, Kp index, space weather alerts.', category: 'space', logo: '/source-imgs/new-noaa.png', brandBg: '#c0c8d0', prefixes: ['spaceweather_'] },
  { id: 'iss', name: 'ISS Tracker', description: 'International Space Station — real-time orbital position, crew count, pass predictions.', category: 'space', logo: '/source-imgs/new-iss.png', brandBg: '#0c0a1a', prefixes: ['iss_'] },
  { id: 'mil_aircraft', name: 'Military Aircraft', description: 'Defense aviation — military flights, tanker ops, surveillance movements via ADS-B.', category: 'space', logo: '/source-imgs/new-milaircraft.png', brandBg: '#1a2332', prefixes: ['mil_aircraft_'] },
]

/** Lookup a source by id */
export function getSource(id: string): VisionSource | undefined {
  return VISION_SOURCES.find(s => s.id === id)
}

/** Get all source IDs */
export function getSourceIds(): string[] {
  return VISION_SOURCES.map(s => s.id)
}

/** Find which source a market ID belongs to, based on prefix matching */
export function getSourceForMarket(marketId: string): VisionSource | undefined {
  const lower = marketId.toLowerCase()
  return VISION_SOURCES.find(s => s.prefixes.some(p => lower.startsWith(p)))
}

/**
 * Maps VISION_SOURCES IDs to data-node source IDs where they differ.
 * Needed because some sources use different IDs in the data-node vs frontend.
 */
const VISION_TO_DATANODE: Record<string, string[]> = {
  coingecko: ['crypto'],
  defillama: ['defi'],
  finnhub: ['stocks'],
  fred: ['rates'],
  treasury: ['bonds'],
  sec: ['sec_13f', 'sec_efts', 'sec_insider'],
  pandascore: ['esports'],
  gtfs_rt: ['gtfs_transit'],
  openmeteo: ['weather'],
  weather: ['weather_stations'],
}

/** Get the primary data-node source ID for a VISION_SOURCE */
export function getDataNodeSourceId(visionSourceId: string): string {
  const mapped = VISION_TO_DATANODE[visionSourceId]
  return mapped ? mapped[0] : visionSourceId
}

/** Get all data-node source IDs for a VISION_SOURCE */
export function getDataNodeSourceIds(visionSourceId: string): string[] {
  return VISION_TO_DATANODE[visionSourceId] ?? [visionSourceId]
}

/** Look up asset count for a VISION_SOURCE using data-node keyed counts */
export function getAssetCountForSource(sourceId: string, assetCounts: Record<string, number>): number {
  let total = assetCounts[sourceId] ?? 0
  const dnIds = VISION_TO_DATANODE[sourceId]
  if (dnIds) {
    for (const dnId of dnIds) {
      total += assetCounts[dnId] ?? 0
    }
  }
  return total
}

/** Look up status for a VISION_SOURCE from data-node source list */
export function getSourceStatusFromMeta(
  sourceId: string,
  sources: Array<{ sourceId: string; status: string }>,
): string {
  const direct = sources.find(s => s.sourceId === sourceId)
  if (direct) return direct.status
  const dnIds = VISION_TO_DATANODE[sourceId]
  if (dnIds) {
    for (const dnId of dnIds) {
      const found = sources.find(s => s.sourceId === dnId)
      if (found) return found.status
    }
  }
  return 'unknown'
}
