/**
 * Brand color maps for sports leagues (ESPN) and esports games (PandaScore).
 *
 * Sports assets: sport_{league}_{game_id}_{metric}  → prefix match on league
 * Esports assets: esport_{game_slug}_{match_id}_{metric} → prefix match on game slug
 *
 * Game slugs are PandaScore's own, hyphenated, lowercase, occasionally
 * inconsistent across tournaments. Every known variant gets its own entry
 * so the longest-prefix match catches it regardless.
 */

import type { LineStyle } from '../transport-colors'
import { registerLineMap } from '../transport-colors'

// ── Sports leagues (ESPN) ────────────────────────────────────────────

const SPORTS_LINES: Record<string, LineStyle> = {
  'nba':        { bg: '#1D428A', fg: '#fff', label: 'NBA' },
  'nfl':        { bg: '#013369', fg: '#fff', label: 'NFL' },
  'epl':        { bg: '#3D195B', fg: '#fff', label: 'EPL' },
  'mlb':        { bg: '#002D72', fg: '#fff', label: 'MLB' },
  'nhl':        { bg: '#000000', fg: '#fff', label: 'NHL' },
  'laliga':     { bg: '#EE8707', fg: '#000', label: 'LLG' },
  'bundesliga': { bg: '#D20515', fg: '#fff', label: 'BUN' },
  'seriea':     { bg: '#024494', fg: '#fff', label: 'SER' },
  'ligue1':     { bg: '#091C3E', fg: '#fff', label: 'LG1' },
  'mls':        { bg: '#231F20', fg: '#fff', label: 'MLS' },
  'wnba':       { bg: '#FF6600', fg: '#000', label: 'WNB' },
  'ucl':        { bg: '#000F45', fg: '#fff', label: 'UCL' },
}

// ── Esports games (PandaScore) ───────────────────────────────────────
// PandaScore slugs vary across tournaments. All known variants are mapped
// so prefix matching resolves regardless of which slug the API returns.

const ESPORTS_LINES: Record<string, LineStyle> = {
  // Counter-Strike
  'cs-go':             { bg: '#DE9B35', fg: '#000', label: 'CS2' },
  'cs-2':              { bg: '#DE9B35', fg: '#000', label: 'CS2' },
  'counter-strike':    { bg: '#DE9B35', fg: '#000', label: 'CS2' },

  // League of Legends
  'league-of-legends': { bg: '#C8AA6E', fg: '#000', label: 'LoL' },
  'lol':               { bg: '#C8AA6E', fg: '#000', label: 'LoL' },
  'lol-wild-rift':     { bg: '#0BC4E2', fg: '#000', label: 'WR' },

  // Dota 2
  'dota-2':            { bg: '#8B0000', fg: '#fff', label: 'D2' },
  'dota2':             { bg: '#8B0000', fg: '#fff', label: 'D2' },

  // Valorant
  'valorant':          { bg: '#FF4655', fg: '#fff', label: 'VAL' },

  // Overwatch
  'overwatch':         { bg: '#FA9C1E', fg: '#000', label: 'OW2' },
  'overwatch-2':       { bg: '#FA9C1E', fg: '#000', label: 'OW2' },

  // King of Glory
  'kog':               { bg: '#1A66FF', fg: '#fff', label: 'KoG' },
  'king-of-glory':     { bg: '#1A66FF', fg: '#fff', label: 'KoG' },

  // Mobile Legends
  'mlbb':                    { bg: '#5B84C4', fg: '#fff', label: 'ML' },
  'mobile-legends-bang-bang': { bg: '#5B84C4', fg: '#fff', label: 'ML' },

  // StarCraft
  'starcraft-2':        { bg: '#0E63C7', fg: '#fff', label: 'SC2' },
  'starcraft-brood-war': { bg: '#A68B5B', fg: '#fff', label: 'BW' },

  // Rainbow Six Siege
  'rainbow-six':       { bg: '#2B5797', fg: '#fff', label: 'R6' },
  'r6siege':           { bg: '#2B5797', fg: '#fff', label: 'R6' },

  // Rocket League
  'rocket-league':     { bg: '#0078F2', fg: '#fff', label: 'RL' },

  // Call of Duty
  'cod-mw':            { bg: '#4CAF50', fg: '#fff', label: 'CoD' },
  'call-of-duty':      { bg: '#4CAF50', fg: '#fff', label: 'CoD' },
  'codmw':             { bg: '#4CAF50', fg: '#fff', label: 'CoD' },

  // PUBG
  'pubg':              { bg: '#F2A900', fg: '#000', label: 'PUB' },

  // EA Sports FC (FIFA)
  'ea-sports-fc':      { bg: '#1B5E20', fg: '#fff', label: 'FC' },
  'ea-fc':             { bg: '#1B5E20', fg: '#fff', label: 'FC' },
  'fifa':              { bg: '#1B5E20', fg: '#fff', label: 'FC' },
}

// ── Registration ─────────────────────────────────────────────────────

registerLineMap('sports', {
  prefix: 'sport_',
  matchMode: 'prefix',
  lines: SPORTS_LINES,
})

registerLineMap('pandascore', {
  prefix: 'esport_',
  matchMode: 'prefix',
  lines: ESPORTS_LINES,
})
