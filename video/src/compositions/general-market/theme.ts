export const THEME = {
  bgLight: '#FFFFFF',
  bgDark: '#0B1426',
  gmGreen: '#00C853',      // GM brand primary
  textDark: '#1A1A2E',
  textLight: '#FFFFFF',
  muted: '#6B7B8D',
  red: '#FF3B30',          // strikethrough, negative
  grey: '#6B7280',         // inactive cells
  divider: '#333333',
} as const;

export const LAYOUT = {
  width: 1920,
  height: 1080,
  fps: 30,
  // Beat durations in frames (30fps)
  beat1Duration: 150,  // 5s LIQUIDITY
  beat2Duration: 150,  // 5s COINS
  beat3Duration: 150,  // 5s GRID EXPANDS
  beat4Duration: 150,  // 5s CATEGORIES
  beat5Duration: 150,  // 5s SETTLEMENT
  beat6Duration: 180,  // 6s FORMULA
  outroDuration: 90,   // 3s CTA
} as const;

export const TOTAL_DURATION = 1020; // ~34s at 30fps

export const CATEGORIES = [
  'politics', 'sports', 'econ',
  'twitch', 'steam', 'films', 'animal cams', 'space launches',
  'weather', 'niche sports', 'music', 'gaming', 'tech', 'everything',
] as const;
