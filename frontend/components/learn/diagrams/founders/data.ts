// Static data for founders demographics charts
// Source: 4,675 founders across 2,741 crypto projects, CoinGecko 2021-2026

export const TGE_AGE_DATA = [
  { tranche: "20-24", days: 106, mult: 3.1, n: 89 },
  { tranche: "25-29", days: 177, mult: 3.4, n: 300 },
  { tranche: "30-34", days: 102, mult: 2.8, n: 336 },
  { tranche: "35-39", days: 119, mult: 2.6, n: 267 },
  { tranche: "40-44", days: 109, mult: 2.5, n: 137 },
  { tranche: "45-49", days: 180, mult: 2.7, n: 84 },
  { tranche: "50-54", days: 89, mult: 2.3, n: 45 },
  { tranche: "55+", days: 17, mult: 2.3, n: 45 },
];

export const TGE_GENDER_DATA = [
  { cat: "All Male", days: 97, mult: 2.8, n: 1061 },
  { cat: "Mixed", days: 145, mult: 5.3, n: 103 },
  { cat: "All Female", days: 136, mult: 2.4, n: 29 },
];

export const TGE_NAT_DATA = [
  { cat: "All US", days: 88, mult: 2.1, n: 250 },
  { cat: "All EU", days: 106, mult: 2.7, n: 217 },
  { cat: "All CN", days: 70, mult: 3.0, n: 104 },
  { cat: "Has US", days: 113, mult: 2.9, n: 164 },
  { cat: "Has EU", days: 188, mult: 3.7, n: 53 },
  { cat: "Has CN", days: 185, mult: 3.7, n: 26 },
  { cat: "Other", days: 108, mult: 3.1, n: 379 },
];

export const TGE_AGE_SPREAD_DATA = [
  { cat: "0-4y", days: 91, mult: 2.9, n: 996 },
  { cat: "5-9y", days: 68, mult: 1.9, n: 89 },
  { cat: "10-19y", days: 214, mult: 5.9, n: 80 },
  { cat: "20y+", days: 294, mult: 4.7, n: 28 },
];

export const TGE_EDU_DATA = [
  { cat: "All PhD", days: 66, mult: 1.7, n: 62 },
  { cat: "All Masters", days: 108, mult: 3.1, n: 123 },
  { cat: "All Bachelor", days: 154, mult: 2.7, n: 121 },
  { cat: "Mixed Higher Ed", days: 79, mult: 2.1, n: 254 },
  { cat: "Mixed w/ Unknown", days: 178, mult: 2.8, n: 168 },
  { cat: "No Education", days: 101, mult: 3.5, n: 465 },
];

export const TIER_SUMMARY = [
  { tier: "Top 100", avgAge: 39.7, ageChange: "+2.8", malePct: 92.9, founders: 198 },
  { tier: "Top 500", avgAge: 39.3, ageChange: "+2.7", malePct: 93.0, founders: 947 },
  { tier: "Top 2000", avgAge: 38.8, ageChange: "+2.8", malePct: 93.1, founders: 2143 },
];

export const LINKEDIN_DATA = [
  { tier: "Top 100", hasLinkedin: 74, noLinkedin: 104, total: 178, pct: 42, noPct: 58 },
  { tier: "Top 500", hasLinkedin: 394, noLinkedin: 458, total: 852, pct: 46, noPct: 54 },
  { tier: "Top 2000", hasLinkedin: 772, noLinkedin: 1257, total: 2029, pct: 38, noPct: 62 },
  { tier: "All (5288)", hasLinkedin: 3153, noLinkedin: 1484, total: 4637, pct: 68, noPct: 32 },
];

// LinkedIn vs No-LinkedIn TGE-to-ATH performance (ATH/ATL, capped at 500x)
export const LINKEDIN_PERF = [
  { tier: "Top 100", liMult: 26.0, noLiMult: 13.8, liDays: 366, noLiDays: 120, liN: 41, noLiN: 27 },
  { tier: "Top 500", liMult: 26.8, noLiMult: 20.7, liDays: 215, noLiDays: 165, liN: 232, noLiN: 136 },
  { tier: "All", liMult: 35.9, noLiMult: 43.6, liDays: 228, noLiDays: 254, liN: 466, noLiN: 407 },
];

// Podcast presence — company-level (best founder presence per company)
// Source: 4,637 founders scanned via DDG search, 1,271 companies with token data

export const PODCAST_DISTRIBUTION = [
  { cat: "Never", founders: 2638, pct: 57 },
  { cat: "Once (1-2)", founders: 1324, pct: 29 },
  { cat: "Regular (3+)", founders: 669, pct: 14 },
];

export const PODCAST_ATH_MULT = [
  { cat: "Regular (3+)", mult: 69.7, mean: 162.3, n: 320 },
  { cat: "Once (1-2)", mult: 53.3, mean: 139.6, n: 345 },
  { cat: "Never", mult: 43.3, mean: 133.9, n: 348 },
];

export const PODCAST_DAYS = [
  { cat: "Regular (3+)", days: 645, mean: 857, n: 368 },
  { cat: "Once (1-2)", days: 454, mean: 693, n: 430 },
  { cat: "Never", days: 445, mean: 652, n: 473 },
];

export const PODCAST_SURVIVAL = [
  { cat: "Regular (3+)", companies: 589, hasToken: 323, pctListed: 55 },
  { cat: "Once (1-2)", companies: 955, hasToken: 345, pctListed: 36 },
  { cat: "Never", companies: 1158, hasToken: 351, pctListed: 30 },
];

export const PODCAST_MCAP = [
  { cat: "Regular (3+)", median: 30.4, mean: 5118.8, n: 360 },
  { cat: "Once (1-2)", median: 13.8, mean: 361.2, n: 409 },
  { cat: "Never", median: 22.2, mean: 105.5, n: 441 },
];

export const PODCAST_TOP500 = [
  { cat: "Regular (3+)", mult: 33.3, days: 598, n: 146 },
  { cat: "Once (1-2)", mult: 33.1, days: 388, n: 101 },
  { cat: "Never", mult: 40.0, days: 387, n: 146 },
];

export const AGE_TIMELINE = [
  { date: "2021-Q1", t100: 36.4, t500: 35.8, t2000: 35.8 },
  { date: "2021-Q2", t100: 36.8, t500: 36.3, t2000: 36.3 },
  { date: "2021-Q3", t100: 36.6, t500: 36.4, t2000: 36.4 },
  { date: "2021-Q4", t100: 37.1, t500: 36.6, t2000: 36.6 },
  { date: "2022-Q1", t100: 37.1, t500: 36.7, t2000: 36.7 },
  { date: "2022-Q2", t100: 37.5, t500: 37.1, t2000: 37.1 },
  { date: "2022-Q3", t100: 38.0, t500: 37.3, t2000: 37.3 },
  { date: "2022-Q4", t100: 38.3, t500: 37.5, t2000: 37.5 },
  { date: "2023-Q1", t100: 38.2, t500: 37.6, t2000: 37.6 },
  { date: "2023-Q2", t100: 37.6, t500: 38.0, t2000: 38.0 },
  { date: "2023-Q3", t100: 37.7, t500: 38.3, t2000: 38.2 },
  { date: "2023-Q4", t100: 37.5, t500: 38.4, t2000: 38.3 },
  { date: "2024-Q1", t100: 38.7, t500: 38.6, t2000: 38.3 },
  { date: "2024-Q2", t100: 38.6, t500: 38.6, t2000: 38.3 },
  { date: "2024-Q3", t100: 39.1, t500: 38.5, t2000: 38.2 },
  { date: "2024-Q4", t100: 39.1, t500: 38.2, t2000: 38.2 },
  { date: "2025-Q1", t100: 39.9, t500: 38.1, t2000: 38.2 },
  { date: "2025-Q2", t100: 40.2, t500: 38.4, t2000: 38.3 },
  { date: "2025-Q3", t100: 39.1, t500: 38.3, t2000: 38.3 },
  { date: "2025-Q4", t100: 39.2, t500: 38.8, t2000: 38.5 },
  { date: "2026-Q1", t100: 39.6, t500: 39.3, t2000: 38.8 },
];
