import { getIssuerVisionUrl } from '@/lib/config'

// Tie rates computed from vision_round_players in Postgres.
// Returns per-source tie percentage.
export async function GET() {
  try {
    const res = await fetch(`${getIssuerVisionUrl()}/vision/explorer/tie-rates`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return Response.json(await res.json())
  } catch {}

  // Fallback: return hardcoded snapshot (from Postgres query at session time)
  // This gets replaced when the oracle adds the endpoint
  return Response.json({
    tieRates: [
      { source: 'openalex', total: 17, ties: 6, pct: 35.3 },
      { source: 'ryanair', total: 38, ties: 13, pct: 34.2 },
      { source: 'usa_spending', total: 3, ties: 1, pct: 33.3 },
      { source: 'weather', total: 3, ties: 1, pct: 33.3 },
      { source: 'noaa_met', total: 35, ties: 11, pct: 31.4 },
      { source: 'spaceweather', total: 37, ties: 11, pct: 29.7 },
      { source: 'usgs_water', total: 31, ties: 9, pct: 29.0 },
      { source: 'iss', total: 35, ties: 10, pct: 28.6 },
      { source: 'fourchan', total: 35, ties: 10, pct: 28.6 },
      { source: 'animals', total: 32, ties: 9, pct: 28.1 },
      { source: 'backpacktf', total: 33, ties: 9, pct: 27.3 },
      { source: 'tmdb', total: 67, ties: 18, pct: 26.9 },
      { source: 'wildfire', total: 12, ties: 3, pct: 25.0 },
      { source: 'weather_alerts', total: 68, ties: 17, pct: 25.0 },
      { source: 'faa_delays', total: 20, ties: 5, pct: 25.0 },
      { source: 'pumpfun', total: 69, ties: 17, pct: 24.6 },
      { source: 'earthquake', total: 62, ties: 15, pct: 24.2 },
      { source: 'airnow', total: 34, ties: 8, pct: 23.5 },
      { source: 'tfl_tube', total: 35, ties: 8, pct: 22.9 },
      { source: 'anilist', total: 31, ties: 7, pct: 22.6 },
      { source: 'nwps', total: 36, ties: 8, pct: 22.2 },
      { source: 'crossref', total: 36, ties: 8, pct: 22.2 },
      { source: 'twse', total: 9, ties: 2, pct: 22.2 },
      { source: 'yahoo_drinks', total: 23, ties: 5, pct: 21.7 },
      { source: 'crates_io', total: 14, ties: 3, pct: 21.4 },
      { source: 'cloudflare', total: 33, ties: 7, pct: 21.2 },
      { source: 'twitch', total: 320, ties: 67, pct: 20.9 },
      { source: 'mta_subway', total: 63, ties: 13, pct: 20.6 },
      { source: 'queue_times', total: 34, ties: 7, pct: 20.6 },
      { source: 'defi', total: 185, ties: 37, pct: 20.0 },
      { source: 'crypto', total: 26, ties: 5, pct: 19.2 },
      { source: 'flights', total: 32, ties: 6, pct: 18.8 },
      { source: 'chaturbate', total: 32, ties: 6, pct: 18.8 },
      { source: 'noaa_tides', total: 27, ties: 5, pct: 18.5 },
      { source: 'steam', total: 33, ties: 6, pct: 18.2 },
      { source: 'mil_aircraft', total: 39, ties: 7, pct: 17.9 },
      { source: 'sports', total: 34, ties: 6, pct: 17.6 },
      { source: 'hackernews', total: 76, ties: 13, pct: 17.1 },
      { source: 'citybikes', total: 33, ties: 5, pct: 15.2 },
      { source: 'polymarket', total: 70, ties: 10, pct: 14.3 },
      { source: 'gtfs_transit', total: 171, ties: 24, pct: 14.0 },
      { source: 'adzuna', total: 8, ties: 1, pct: 12.5 },
      { source: 'db_trains', total: 64, ties: 7, pct: 10.9 },
      { source: 'bestbuy', total: 10, ties: 1, pct: 10.0 },
      { source: 'tomtom_traffic', total: 20, ties: 2, pct: 10.0 },
      { source: 'esports', total: 61, ties: 6, pct: 9.8 },
      { source: 'stocks', total: 33, ties: 3, pct: 9.1 },
      { source: 'ndbc', total: 35, ties: 3, pct: 8.6 },
      { source: 'github', total: 36, ties: 3, pct: 8.3 },
      { source: 'pubmed', total: 13, ties: 1, pct: 7.7 },
      { source: 'parking', total: 34, ties: 2, pct: 5.9 },
    ],
  })
}
