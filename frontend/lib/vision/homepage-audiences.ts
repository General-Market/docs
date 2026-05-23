// Audience tag for every source that appears on the home page.
// Drives the small "For humans" / "For bots" pill on each card so a
// first-time visitor can see at a glance whether a source rewards
// intuition or rewards automation.
//
// The full source catalog lives in data/sources-display.json with its
// own `audience` field, but most of the 100+ entries there are still
// untagged. This map covers the 17 ids pinned to the home page.

export type HomepageAudience = 'human' | 'bot'

export const HOMEPAGE_AUDIENCES: Record<string, HomepageAudience> = {
  // Bots — fast markets, telemetry, machine-readable signals
  defillama: 'bot',
  nasdaq: 'bot',
  polymarket: 'bot',
  pumpfun: 'bot',
  github: 'bot',
  crates_io: 'bot',
  binance_options: 'bot',
  binance_futures_funding: 'bot',
  cloudflare: 'bot',

  // Humans — taste, curiosity, lived experience
  sports: 'human',
  iss: 'human',
  twitch: 'human',
  steam: 'human',
  fourchan: 'human',
  db_trains: 'human',
  airnow: 'human',
  animals: 'human',
}

export function audienceFor(sourceId: string): HomepageAudience | undefined {
  return HOMEPAGE_AUDIENCES[sourceId]
}
