/**
 * Vision source registry — single source of truth for all source metadata.
 *
 * To add a new source: add ONE entry to VISION_SOURCES below.
 * All display metadata (name, logo, value labels, units) lives here.
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
  /** Column header label in markets table (e.g. "Price", "Avg Delay") */
  valueLabel: string
  /** Unit shown in parentheses (e.g. "USD", "min", "%") */
  valueUnit: string
  /** If true, values are formatted with $ prefix */
  isPrice?: boolean
}

// Helper to reduce boilerplate — most sources share the same shape
const S = (
  id: string, name: string, description: string, category: SourceCategory,
  logo: string, brandBg: string, prefixes: string[],
  valueLabel: string, valueUnit: string, isPrice?: boolean,
): VisionSource => ({ id, name, description, category, logo, brandBg, prefixes, valueLabel, valueUnit, isPrice })

/**
 * All data sources mapped from data-node/src/market_data/sources/.
 * Each entry is the single source of truth for display + value formatting.
 */
export const VISION_SOURCES: VisionSource[] = [
  // ── Finance ──
  S('coingecko',       'CoinGecko Crypto',       'Cryptocurrency market data — prices, volumes, market caps for thousands of tokens.',                          'finance', '/source-imgs/new-coingecko.png',  '#f5f5f5',                                    ['crypto_'],           'Price',        'USD', true),
  S('pumpfun',         'Pump.fun Tokens',         'Solana memecoin launchpad — real-time prices, volumes, and market caps for recently launched tokens.',        'finance', '/source-imgs/new-pumpfun.png',    'linear-gradient(135deg,#00d18c,#1a1a2e)',     ['pumpfun_'],          'Price',        'USD', true),
  S('defillama',       'DefiLlama DeFi',          'DeFi protocol analytics — TVL, yields, fees, volumes across all major chains and protocols.',                'finance', '/source-imgs/new-defillama.png',  '#1b1b1b',                                    ['defi_'],             'TVL',          'USD', true),
  S('finnhub',         'Finnhub Stocks',          'Real-time stock market data — US equities, forex, and crypto with company fundamentals.',                    'finance', '/source-imgs/new-finnhub.png',    '#000000',                                    ['stock_', 'stocks_'], 'Price',        'USD', true),
  S('nasdaq',          'Nasdaq Listings',         'Official Nasdaq exchange data — listed securities, ETFs, and index constituents.',                           'finance', '/source-imgs/new-nasdaq.svg',     '#f5f5f5',                                    ['nasdaq_'],           'Price',        'USD', true),
  S('zillow',          'Zillow Real Estate',       'US housing market data — home values, rent indices, inventory, and price-to-rent ratios.',                  'finance', '/source-imgs/zillow.svg',         '#1b1b1b',                                    ['zillow_'],           'Price',        'USD', true),
  S('polymarket',      'Polymarket Predictions',   'Prediction market data — real-time odds and volumes for events across politics, crypto, sports.',           'finance', '/source-imgs/new-polymarket.png', '#1b1b1b',                                    ['poly_'],             'Probability',  '%'),
  S('finra',           'FINRA Short Interest',     'Short selling data — daily short volume and total volume for all US exchange-listed securities.',            'finance', '/source-imgs/finra.svg',          '#e8edf4',                                    ['finra_'],            'Short Volume', 'shares'),
  S('finra_short_vol', 'FINRA Short Volume',       'Daily short volume and total volume for exchange-listed securities from FINRA reports.',                    'finance', '/source-imgs/finra.svg',          '#e8edf4',                                    ['finra_short_vol_'],  'Short Volume', 'shares'),
  S('futures',         'Continuous Futures',        'Continuous front-month futures contracts — commodities, indices, currencies, and interest rates.',          'finance', '/source-imgs/new-fred.png',       '#f5f5f5',                                    ['futures_'],          'Price',        'USD', true),
  S('bchain',          'Bitcoin On-Chain',          'Bitcoin blockchain metrics — hashrate, difficulty, block size, miner revenue, transaction volume.',         'finance', '/source-imgs/new-bitcoin.png',    '#f5f5f5',                                    ['bchain_'],           'Value',        '',    true),
  S('yahoo_drinks',    'Yahoo Drinks',              'Coffee, sugar, cocoa, OJ futures and major beverage company stock prices via Yahoo Finance.',              'finance', '/source-imgs/new-yahoodrinks.png','#f5f5f5',                                    ['yahoo_drinks_'],     'Price',        'USD', true),
  S('twse',            'Taiwan Stock Exchange',     'TWSE market data — daily OHLCV, foreign investor flows, margin trading for Taiwanese equities.',           'finance', '/source-imgs/new-twse.svg',       '#f5f5f5',                                    ['twse_'],             'Price',        'TWD', true),
  S('bestbuy',         'Best Buy Products',         'Consumer electronics pricing — real-time sale prices across 7 categories from top-selling products.',      'finance', '/source-imgs/new-bestbuy.png',    '#f5f5f5',                                    ['bestbuy_'],          'Sale Price',   'USD', true),

  // ── Economic ──
  S('fred',            'FRED Interest Rates',       'Federal Reserve Economic Data — interest rates, yield curves, money supply, employment, inflation.',      'economic', '/source-imgs/new-fred.png',      '#f5f5f5',                                    ['fred_'],             'Rate',         '%'),
  S('eia',             'EIA Energy Data',            'Energy Information Administration — crude oil, natural gas, electricity, renewable energy.',              'economic', '/source-imgs/new-eia.png',       '#00526e',                                    ['eia_'],              'Value',        ''),
  S('treasury',        'US Treasury Yields',         'Daily yield curve rates — T-bills, notes, and bonds from 1-month to 30-year maturities.',               'economic', '/source-imgs/new-treasury.svg',  '#0057b7',                                    ['treasury_', 'tsy_'], 'Yield',        '%'),
  S('ecb',             'ECB Exchange Rates',          'European Central Bank — exchange rates, monetary aggregates, bank lending, euro area indicators.',      'economic', '/source-imgs/new-ecb.svg',       '#f0f2f5',                                    ['ecb_'],              'Value',        ''),
  S('worldbank',       'World Bank Indicators',       'Development indicators — GDP, population, poverty, health, education for 200+ countries.',             'economic', '/source-imgs/new-worldbank.svg', '#f5f5f5',                                    ['worldbank_'],        'Value',        ''),
  S('bls',             'Bureau of Labor Stats',        'Bureau of Labor Statistics — CPI, unemployment, job openings, producer prices, wage data.',           'economic', '/source-imgs/new-bls.svg',       '#f5f5f5',                                    ['bls_'],              'Index',        ''),
  S('adzuna',          'Adzuna Jobs',                   'Job vacancy counts and average advertised salaries across US, UK, Germany, and France.',             'economic', '/source-imgs/new-adzuna.png',    '#f5f5f5',                                    ['adzuna_'],           'Avg Salary',   ''),
  S('usa_spending',    'Federal Spending',               'Federal spending — contracts, grants, loans, and government outlays by agency and program.',        'economic', '/source-imgs/usaspending.png',   '#f5f5f5',                                    ['usa_spending_'],     'Amount',       'USD', true),
  S('imf',             'IMF Indicators',                 'International Monetary Fund — GDP, trade, debt, reserves, and fiscal indicators for 190+ countries.','economic', '/source-imgs/new-imf.svg',      '#002244',                                    ['imf_'],              'Value',        ''),
  S('opec',            'OPEC Oil Data',                  'OPEC reference basket price and production data for global oil market analysis.',                   'economic', '/source-imgs/new-eia.png',       '#005fa3',                                    ['opec_'],             'Basket Price', 'USD/bbl', true),
  S('cftc',            'CFTC Commitments',               'Commitments of Traders — weekly positions of commercial and speculative traders in futures markets.','economic', '/source-imgs/new-fred.png',      '#f5f5f5',                                    ['cftc_'],             'Contracts',    'lots'),

  // ── Regulatory ──
  S('sec',             'SEC Filings',             'Institutional investment disclosures — 13F holdings, EDGAR filings, and insider transactions.',              'regulatory', '/source-imgs/new-sec.svg',         '#0a3055',                                 ['sec_edgar_', 'sec_efts_', 'sec_insider_'], 'Filings', ''),
  S('congress',        'Congress Votes',          'US legislative data — bill introductions, votes, committee actions, congressional metrics.',                 'regulatory', '/source-imgs/congress.png',         'linear-gradient(135deg,#1a2744,#2d4a7a)', ['congress_'],   'Count',      ''),
  S('courtlistener',   'Federal Courts',          'Daily federal court filing counts — opinions, docket entries, and new cases across 34 courts.',              'regulatory', '/source-imgs/new-courtlistener.png','#f5f5f5',                                 ['court_'],      'Filings',    '/day'),
  S('nyc311',          'NYC 311 Complaints',      'Real-time New York City 311 complaint counts across 30 categories — noise, rodents, parking, and more.',     'regulatory', '/source-imgs/new-nyc311.svg',      '#002D72',                                 ['nyc311_'],     'Complaints', '/24h'),

  // ── Tech & Dev ──
  S('github',          'GitHub Repositories',     'Open source activity — stars, forks, issues, commits, and contributor metrics.',                             'tech', '/source-imgs/new-github.png',        '#24292e',  ['github_'],        'Stars',     ''),
  S('npm',             'npm Packages',            'JavaScript ecosystem — daily/weekly download counts and framework adoption trends.',                         'tech', '/source-imgs/new-npm.png',           '#f5f5f5',  ['npm_'],           'Downloads', '/wk'),
  S('pypi',            'PyPI Packages',           'Python package index — download statistics, version releases, and adoption metrics.',                        'tech', '/source-imgs/new-pypi.svg',          '#006dad',  ['pypi_'],          'Downloads', '/day'),
  S('crates_io',       'Crates.io Rust',          'Rust ecosystem — crate downloads, versions, and dependency metrics.',                                       'tech', '/source-imgs/new-cratesio.png',      '#173d13',  ['crates_io_'],     'Downloads', ''),
  S('stackexchange',   'StackOverflow',           'Developer activity — daily new question counts by popular tag tracking framework and language adoption.',    'tech', '/source-imgs/new-stackoverflow.png', '#f5f5f5',  ['stackexchange_'], 'Questions', '/day'),
  S('hackernews',      'Hacker News',             'Tech community pulse — top stories, trending topics, engagement from Y Combinator\'s forum.',                'tech', '/source-imgs/new-hackernews.svg',    '#f66a0a',  ['hn_'],            'Score',     'pts'),
  S('cloudflare',      'Cloudflare DNS',          'Internet traffic insights — domain popularity, traffic trends, and attack analytics.',                       'tech', '/source-imgs/new-cloudflare.svg',    '#f5f5f5',  ['cloudflare_'],    'Rank',      ''),

  // ── Academic ──
  S('openalex',        'OpenAlex Papers',         'Scholarly work tracker — daily new publication counts by research field across 25 academic disciplines.',    'academic', '/source-imgs/new-openalex.png', '#f5f5f5', ['openalex_'],  'Papers',   '/day'),
  S('crossref',        'Crossref Citations',      'Scholarly publishing — daily new DOI registrations by document type tracking research output trends.',       'academic', '/source-imgs/new-crossref.png', '#f5f5f5', ['crossref_'],  'DOIs',     ''),
  S('pubmed',          'PubMed Medical',          'NCBI biomedical literature — daily new article counts by topic across 24 medical research areas.',           'academic', '/source-imgs/new-pubmed.png',   '#f5f5f5', ['pubmed_'],    'Articles', ''),

  // ── Entertainment ──
  S('twitch',          'Twitch Streaming',        'Live streaming metrics — viewer counts, active streams, top categories, channel growth.',                    'entertainment', '/source-imgs/new-twitch.png',     '#9146FF',                                 ['twitch_'],      'Viewers',    'live'),
  S('tmdb',            'Movies & TV',             'Film and television — box office, ratings, popularity scores, and trending titles.',                         'entertainment', '/source-imgs/new-tmdb.svg',       '#032551',                                 ['tmdb_'],        'Popularity', 'score'),
  S('lastfm',          'Last.fm Music',           'Music analytics — top artist listener counts, playcounts, and chart trends from Last.fm.',                   'entertainment', '/source-imgs/new-lastfm.png',     '#f5f5f5',                                 ['lastfm_'],      'Listeners',  ''),
  S('steam',           'Steam Gaming',            'PC gaming — concurrent players, game releases, review scores, and player count trends.',                     'entertainment', '/source-imgs/new-steam.png',      '#171a21',                                 ['steam_'],       'Players',    'online'),
  S('anilist',         'AniList Anime',           'Anime and manga — popularity, ratings, seasonal rankings, community engagement.',                            'entertainment', '/source-imgs/new-anilist.png',    '#152232',                                 ['anilist_'],     'Popularity', 'score'),
  S('reddit',          'Reddit Communities',      'Community analytics — subscriber counts and active users across 100+ curated subreddits.',                   'entertainment', '/source-imgs/new-reddit.png',     '#1a1a2e',                                 ['reddit_'],      'Subscribers',''),
  S('chaturbate',      'Chaturbate Live',         'Adult streaming metrics — live viewer counts for top models from the public affiliate API.',                 'entertainment', '/source-imgs/new-chaturbate.png', '#f5f5f5',                                 ['cb_model_'],    'Viewers',    'live'),
  S('bgg',             'Board Games',             'Board game trends — hotness rankings for top 50 board games from the BGG community.',                        'entertainment', '/source-imgs/new-bgg.png',        '#f5f5f5',                                 ['bgg_'],         'Hotness',    '#'),
  S('backpacktf',      'Backpack.tf Trading',     'TF2 economy — item prices, unusual hat values, and virtual item trading volume.',                            'entertainment', '/source-imgs/new-backpacktf.png', '#363636',                                 ['backpacktf_'],  'Price',      'USD', true),
  S('fourchan',        '4chan Boards',             'Imageboard sentiment — post volumes, trending topics across /biz/, /pol/, and more.',                        'entertainment', '/source-imgs/fourchan.png',       'linear-gradient(135deg,#6b8e6b,#3d5c3d)', ['fourchan_'],    'Activity',   ''),
  S('sports',          'Sports Stats',            'Live sports data — scores, standings, schedules, stats across NFL, NBA, MLB, NHL.',                          'entertainment', '/source-imgs/new-espn.svg',       '#1b1b1b',                                 ['sport_'],       'Score',      'pts'),
  S('pandascore',      'Esports',                 'Esports match tracking — live scores across CS2, LoL, Dota 2, Valorant, and more.',                          'entertainment', '/source-imgs/new-pandascore.png', '#f5f5f5',                                 ['esport_'],      'Score',      ''),
  S('queue_times',     'Theme Park Waits',        'Average ride wait times across 30+ major theme parks worldwide — Disney, Universal, and more.',               'entertainment', '/source-imgs/new-queuetimes.png', '#1a1a2e',                                 ['queue_times_'], 'Avg Wait',   'min'),
  S('mcbroken',        'McBroken Ice Cream',      'McDonald\'s ice cream machine broken percentage across 30 US cities — real-time status tracking.',            'entertainment', '/source-imgs/new-mcbroken.svg',   '#FFC72C',                                 ['mcbroken_'],    '% Broken',   '%'),

  // ── Geophysical ──
  S('earthquake',      'USGS Earthquakes',        'Seismic event data — real-time magnitudes, depths, and locations from the seismic network.',                 'geophysical', '/source-imgs/new-usgs.svg',       '#f5f5f5',  ['earthquake_'],    'Magnitude',    'M'),
  S('volcano',         'Volcano Activity',        'Volcanic activity monitoring — alert levels, eruption status, hazard assessments worldwide.',                'geophysical', '/source-imgs/new-volcano.png',    '#c0cfe0',  ['volcano_'],       'Alert Level',  '0-4'),
  S('weather',         'NOAA Weather',            'Official NWS forecasts — point forecasts, area discussions, and observation data across the US.',            'geophysical', '/source-imgs/new-noaa.png',       '#f5f5f5',  ['weather_'],       'Temperature',  '°F'),
  S('weather_alerts',  'Weather Alerts',          'National Weather Service — warnings, watches, advisories for severe weather across the US.',                 'geophysical', '/source-imgs/new-nws.svg',        '#FFF3E0',  ['weather_alert_'], 'Count',        'alerts'),
  S('openmeteo',       'Open-Meteo',              'Global weather forecasts — temperature, precipitation, wind, and historical climate data.',                  'geophysical', '/source-imgs/new-openmeteo.png',  '#f5f5f5',  ['openmeteo_'],     'Temperature',  '°C'),
  S('airnow',          'Air Quality',             'EPA air quality index — real-time AQI readings across 300+ US metropolitan reporting areas.',                'geophysical', '/source-imgs/new-airnow.png',     '#f5f5f5',  ['airnow_'],        'AQI',          '0-500'),
  S('usgs_water',      'USGS Water',              'River discharge monitoring — real-time streamflow data from USGS stations across 15 US states.',             'geophysical', '/source-imgs/new-usgswater.png',  '#f5f5f5',  ['usgs_water_'],    'Discharge',    'ft³/s'),
  S('noaa_met',        'NOAA Ocean Met',          'Water temperature and wind speed from 59 major US coastal meteorological stations.',                         'geophysical', '/source-imgs/new-noaamet.png',    '#f5f5f5',  ['noaa_met_'],      'Temp',         '°F'),
  S('noaa_tides',      'NOAA Tides',              'Real-time water levels from 59 major US tide stations relative to MLLW datum.',                              'geophysical', '/source-imgs/new-noaatides.png',  '#f5f5f5',  ['noaa_tide_'],     'Water Level',  'ft'),
  S('ndbc',            'NDBC Ocean Buoys',        'Wave height and ocean conditions from NDBC buoys across US coastal and offshore waters.',                    'geophysical', '/source-imgs/new-ndbc.png',       '#f5f5f5',  ['ndbc_'],          'Wave Height',  'm'),
  S('nwps',            'River Gauges',            'Real-time river gauge heights and flood stage data from 68 major US waterway monitoring points.',             'geophysical', '/source-imgs/new-nwps.png',       '#f5f5f5',  ['nwps_'],          'Stage Height', 'ft'),
  S('nrc_nuclear',     'NRC Nuclear',             'Daily power output percentage for all 93 US commercial nuclear reactors from NRC reports.',                  'geophysical', '/source-imgs/new-nrcnuclear.png', '#f5f5f5',  ['nrc_'],           'Power',        '%'),
  S('wildfire',        'Wildfire Tracking',       'Satellite fire detection — real-time active fire data from MODIS and VIIRS instruments.',                    'geophysical', '/source-imgs/new-firms.png',      '#2d1810',  ['wildfire_'],      'Hotspots',     'fires'),
  S('epidemic',        'Disease Tracking',        'Global disease tracking — case counts, deaths, vaccination rates by country.',                               'geophysical', '/source-imgs/new-diseasesh.png',  '#1b1b1b',  ['epidemic_'],      'Cases',        ''),

  // ── Transport ──
  S('flights',         'Global Flights',          'Aviation tracking — live flight counts, airport traffic, airline ops, airspace congestion.',                  'transport', '/source-imgs/new-flights.png',       '#2a2a2a',                                  ['flights_'],         'Flights',      'active'),
  S('gtfs_rt',         'Transit Realtime',        'Public transit feeds — real-time bus/rail positions, service alerts, schedule adherence.',                    'transport', '/source-imgs/new-transitland2.svg', '#f0f2f5',                                  ['gtfs_'],            'Delay',        'min'),
  S('citybikes',       'CityBikes',               'Available bikes across 30 major bike-sharing networks worldwide — real-time station data.',                  'transport', '/source-imgs/new-citybikes.svg',    'linear-gradient(135deg,#ffb800,#f59e00)',   ['citybikes_'],       'Available',    'bikes'),
  S('parking',         'Parking Availability',     'Real-time free parking space counts across 20+ European cities from municipal sensors.',                    'transport', '/source-imgs/new-parkapi.png',      'linear-gradient(135deg,#e8eaf6,#c5cae9)',  ['parking_'],         'Free Spaces',  ''),
  S('tomtom_traffic',  'TomTom Traffic',           'Real-time road congestion ratios for 20+ highway corridors — current speed vs free-flow speed.',            'transport', '/source-imgs/new-tomtomtraffic.png','#f5f5f5',                                  ['tomtom_traffic_'],  'Congestion',   'ratio'),
  S('tomtom_evcharge', 'EV Charging',              'Available EV charging connectors at 25+ major charging hubs worldwide — real-time availability.',          'transport', '/source-imgs/new-tomtomev.png',     '#f5f5f5',                                  ['tomtom_evcharge_'], 'Available',    'connectors'),
  S('cbp_border',      'Border Wait Times',        'US Customs and Border Protection — real-time passenger and commercial wait times at all ports of entry.',  'transport', '/source-imgs/new-cbpborder.png',    '#1a2744',                                  ['cbp_border_'],      'Wait Time',    'min'),
  S('faa_delays',      'Airport Delays',            'Real-time delay status for 30 major US airports from the FAA Airport Status Web Service.',                'transport', '/source-imgs/new-faadelays.png',    '#f5f5f5',                                  ['faa_delays_'],      'Delay',        '0/1'),
  S('db_trains',       'Deutsche Bahn',              'Average train delay in minutes at 58 major German stations — real-time departure data from Deutsche Bahn.','transport', '/source-imgs/new-dbtrains.svg',    '#ec0016',                                  ['db_trains_'],       'Avg Delay',    'min'),
  S('mta_subway',     'NYC Subway',                 'Disruption severity for 24 NYC subway lines — real-time service status from MTA.',                         'transport', '/source-imgs/new-mta.png',         '#0039A6',                                  ['mta_subway_'],      'Disruption',   '0-5'),
  S('paris_metro',    'Paris Metro',                'Disruption severity for 16 Paris metro lines — real-time service status from RATP/IDFM.',                  'transport', '/source-imgs/new-ratp.png',        '#003B80',                                  ['paris_metro_'],     'Disruption',   '0-4'),
  S('ryanair',         'Ryanair Delays',             'Average flight delay in minutes at 40 major Ryanair airports — schedule vs ADS-B tracking.',              'transport', '/source-imgs/new-ryanair.svg',      '#f5f5f5',                                  ['ryanair_'],         'Avg Delay',    'min'),
  S('tfl_tube',        'London Underground',         'Disruption severity for 11 London Underground lines — real-time status from TfL.',                       'transport', '/source-imgs/new-tfl.svg',          '#f5f5f5',                                  ['tfl_tube_'],        'Disruption',   '0-8'),
  S('ioda',            'Internet Outages',           'Internet connectivity score for 50 countries — BGP, Active Probing, and Darknet signals via IODA.',      'tech',      '/source-imgs/new-ioda.svg',         '#1a1a2e',                                  ['ioda_'],            'Connectivity', '%'),
  S('power_outages',   'US Power Outages',           'Customers without power per US state from the DOE ODIN platform — real-time utility reports.',           'geophysical', '/source-imgs/new-poweroutage.png', '#f5f5f5',                                 ['power_outages_'],   'Affected',     'customers'),
  S('aisstream',       'Ship Tracking',              'Real-time AIS stream — live vessel positions, speeds, and routes from AIS receivers.',                   'transport', '/source-imgs/new-aisstream.png',    '#1b1b1b',                                  ['aisstream_'],       'Vessels',      ''),
  S('maritime',        'Port Data',                  'Ship tracking — vessel positions, port traffic, shipping lane activity, cargo movements.',                'transport', '/source-imgs/new-marinetraffic.png','#1b1b1b',                                  ['maritime_'],        'Ships',        ''),

  // ── Nature ──
  S('ebird',           'eBird Observations',      'Global birding data — species checklists, hotspot activity, migration timing from Cornell Lab.',             'nature', '/source-imgs/new-ebird.svg',       '#f5f5f5',  ['ebird_'],    'Observations', ''),
  S('animals',         'Wildlife Tracking',       'Citizen science biodiversity — species sightings, observation counts, ecological trends.',                   'nature', '/source-imgs/new-inaturalist.svg', '#f5f5f5',  ['animals_'],  'Observations', '/24h'),
  S('movebank',        'Animal Migration',        'Animal movement tracking — GPS telemetry for wildlife migration studies worldwide.',                          'nature', '/source-imgs/movebank.png',        '#e8f0e8',  ['movebank_'], 'Locations',    ''),
  S('shelter',         'Animal Shelters',         'Stray animal counts at shelters by species and status — dogs and cats via Socrata open data.',                'nature', '/source-imgs/new-shelter.png',     '#f5f5f5',  ['shelter_'],  'Count',        'animals'),

  // ── Space ──
  S('spaceweather',    'Space Weather',           'Solar activity — solar flares, geomagnetic storms, Kp index, space weather alerts.',                         'space', '/source-imgs/new-noaa.png',        '#c0c8d0', ['spaceweather_'], 'Kp Index',  '0-9'),
  S('iss',             'ISS Tracker',             'International Space Station — real-time orbital position, crew count, pass predictions.',                    'space', '/source-imgs/new-iss.png',         '#0c0a1a', ['iss_'],          'Position',  ''),
  S('mil_aircraft',    'Military Aircraft',       'Defense aviation — military flights, tanker ops, surveillance movements via ADS-B.',                          'space', '/source-imgs/new-milaircraft.png', '#1a2332', ['mil_aircraft_'], 'Count',     ''),
]

// ── Fast lookup map (built once) ──
const SOURCE_BY_ID = new Map(VISION_SOURCES.map(s => [s.id, s]))

/** Get value label for a source (e.g. "Price", "Avg Delay", "Magnitude") */
export function getSourceValueLabel(sourceId: string): string {
  return SOURCE_BY_ID.get(sourceId)?.valueLabel ?? 'Value'
}

/** Whether this source's values should be formatted as currency with $ prefix */
export function isSourcePriceType(sourceId: string): boolean {
  return SOURCE_BY_ID.get(sourceId)?.isPrice ?? false
}

/** Get the unit suffix for a source (e.g. "USD", "min", "%") */
export function getSourceUnit(sourceId: string): string {
  return SOURCE_BY_ID.get(sourceId)?.valueUnit ?? ''
}

/** Lookup a source by id */
export function getSource(id: string): VisionSource | undefined {
  return SOURCE_BY_ID.get(id)
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
