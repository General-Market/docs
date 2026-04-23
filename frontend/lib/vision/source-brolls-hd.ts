// Set of source IDs with a 720p HD variant in /public/source-video/hd/.
// Maintained by hand (or regenerated from `ls public/source-video/hd/`)
// so we never request a 404. Sources not in this set keep the 144p SD clip
// regardless of viewport.
export const SOURCE_BROLLS_HD: ReadonlySet<string> = new Set([
  'adzuna',
  'airnow',
  'anilist',
  'animals',
  'backpacktf',
  'bchain',
  'bgg',
  'boe',
  'cftc',
  'citybikes',
  'cloudflare',
  'coingecko',
  'congress',
  'crates_io',
  'crossref',
  'db_trains',
  'earthquake',
  'ebird',
  'epidemic',
  'faa_delays',
  'finnhub',
  'flights',
  'fred',
  'futures',
  'github',
  'hackernews',
  'ioda',
  'iss',
  'lastfm',
  'lichess',
  'mil_aircraft',
  'movebank',
  'mta_subway',
  'nasdaq',
  'noaa_met',
  'noaa_tides',
  'nwps',
  'nyc311',
  'openmeteo',
  'pandascore',
  'paris_metro',
  'power_outages',
  'pumpfun',
  'queue_times',
  'reddit',
  'sec',
  'sports',
  'steam',
  'tfl_tube',
  'tomtom_traffic',
  'treasury',
  'tubes',
  'twitch',
  'twse',
  'usgs_water',
  'volcano',
  'weather',
  'weather_alerts',
  'wildfire',
  'worldbank',
])

/**
 * Returns the HD path if the source has an HD variant, else undefined.
 * Caller decides whether to use HD based on viewport.
 */
export function getHdBrollPath(sourceId: string, sdPath: string): string | undefined {
  return SOURCE_BROLLS_HD.has(sourceId)
    ? sdPath.replace('/source-video/', '/source-video/hd/')
    : undefined
}
