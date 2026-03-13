/**
 * University logo mapping using Clearbit Logo API.
 * Maps university names (as they appear in founders data) to logo URLs.
 */

export const UNIVERSITY_LOGOS: Record<string, string> = {
  'Stanford University': 'https://logo.clearbit.com/stanford.edu',
  'University of Pennsylvania': 'https://logo.clearbit.com/upenn.edu',
  'University of Waterloo': 'https://logo.clearbit.com/uwaterloo.ca',
  'UCLA': 'https://logo.clearbit.com/ucla.edu',
  'Peking University': 'https://logo.clearbit.com/pku.edu.cn',
  'Princeton University': 'https://logo.clearbit.com/princeton.edu',
  'University of Sydney': 'https://logo.clearbit.com/sydney.edu.au',
  'UC Berkeley': 'https://logo.clearbit.com/berkeley.edu',
  'University of Michigan': 'https://logo.clearbit.com/umich.edu',
  'Columbia University': 'https://logo.clearbit.com/columbia.edu',
  'Tel Aviv University': 'https://logo.clearbit.com/tau.ac.il',
  'University of Notre Dame': 'https://logo.clearbit.com/nd.edu',
  'Harvard University': 'https://logo.clearbit.com/harvard.edu',
  'Shanghai Jiao Tong University': 'https://logo.clearbit.com/sjtu.edu.cn',
  'University of Toronto': 'https://logo.clearbit.com/utoronto.ca',
  'National University of Singapore': 'https://logo.clearbit.com/nus.edu.sg',
  'University of Singapore': 'https://logo.clearbit.com/nus.edu.sg',
  'Imperial College London': 'https://logo.clearbit.com/imperial.ac.uk',
  'McGill University': 'https://logo.clearbit.com/mcgill.ca',
  'MIT': 'https://logo.clearbit.com/mit.edu',
  'University of Manchester': 'https://logo.clearbit.com/manchester.ac.uk',
  'University of Washington': 'https://logo.clearbit.com/uw.edu',
  'Cornell University': 'https://logo.clearbit.com/cornell.edu',
  'University of Zurich': 'https://logo.clearbit.com/uzh.ch',
  'Johns Hopkins University': 'https://logo.clearbit.com/jhu.edu',
  'University of Melbourne': 'https://logo.clearbit.com/unimelb.edu.au',
  'Bocconi University': 'https://logo.clearbit.com/unibocconi.eu',
  'University of Colorado Boulder': 'https://logo.clearbit.com/colorado.edu',
  'ETH Zurich': 'https://logo.clearbit.com/ethz.ch',
  'Tsinghua University': 'https://logo.clearbit.com/tsinghua.edu.cn',
  'University of Oxford': 'https://logo.clearbit.com/ox.ac.uk',
  'University of Cambridge': 'https://logo.clearbit.com/cam.ac.uk',
  'Carnegie Mellon University': 'https://logo.clearbit.com/cmu.edu',
  'Duke University': 'https://logo.clearbit.com/duke.edu',
  'Yale University': 'https://logo.clearbit.com/yale.edu',
  'Caltech': 'https://logo.clearbit.com/caltech.edu',
  'Georgia Tech': 'https://logo.clearbit.com/gatech.edu',
  'Brown University': 'https://logo.clearbit.com/brown.edu',
  'Northwestern University': 'https://logo.clearbit.com/northwestern.edu',
  'New York University': 'https://logo.clearbit.com/nyu.edu',
  'University of Illinois': 'https://logo.clearbit.com/illinois.edu',
  'University of Texas': 'https://logo.clearbit.com/utexas.edu',
  'University of Chicago': 'https://logo.clearbit.com/uchicago.edu',
  'London School of Economics': 'https://logo.clearbit.com/lse.ac.uk',
  'University of British Columbia': 'https://logo.clearbit.com/ubc.ca',
  'Nanyang Technological University': 'https://logo.clearbit.com/ntu.edu.sg',
  'Seoul National University': 'https://logo.clearbit.com/snu.ac.kr',
  'University of Hong Kong': 'https://logo.clearbit.com/hku.hk',
  'Technion': 'https://logo.clearbit.com/technion.ac.il',
  'Hebrew University': 'https://logo.clearbit.com/huji.ac.il',
}

/**
 * Fuzzy keyword patterns for matching messy university names.
 * Order matters: more specific patterns come first.
 */
const FUZZY_PATTERNS: [RegExp, string][] = [
  [/\bStanford\b/i, 'Stanford University'],
  [/\bUPenn\b|\bUniversity of Pennsylvania\b/i, 'University of Pennsylvania'],
  [/\bWaterloo\b/i, 'University of Waterloo'],
  [/\bUCLA\b/i, 'UCLA'],
  [/\bPeking\b/i, 'Peking University'],
  [/\bPrinceton\b/i, 'Princeton University'],
  [/\bUniversity of Sydney\b/i, 'University of Sydney'],
  [/\bUC Berkeley\b|\bBerkeley\b/i, 'UC Berkeley'],
  [/\bUniversity of Michigan\b|\bUMich\b/i, 'University of Michigan'],
  [/\bColumbia University\b|\bColumbia\b/i, 'Columbia University'],
  [/\bTel Aviv\b/i, 'Tel Aviv University'],
  [/\bNotre Dame\b/i, 'University of Notre Dame'],
  [/\bHarvard\b/i, 'Harvard University'],
  [/\bShanghai Jiao Tong\b|\bSJTU\b/i, 'Shanghai Jiao Tong University'],
  [/\bUniversity of Toronto\b|\bUofT\b/i, 'University of Toronto'],
  [/\bNUS\b|\bNational University of Singapore\b|\bUniversity of Singapore\b/i, 'National University of Singapore'],
  [/\bImperial College\b/i, 'Imperial College London'],
  [/\bMcGill\b/i, 'McGill University'],
  [/\bMIT\b|\bMassachusetts Institute of Technology\b/i, 'MIT'],
  [/\bUniversity of Manchester\b|\bManchester\b/i, 'University of Manchester'],
  [/\bUniversity of Washington\b|\bUW\b/i, 'University of Washington'],
  [/\bCornell\b/i, 'Cornell University'],
  [/\bUniversity of Zurich\b|\bUZH\b/i, 'University of Zurich'],
  [/\bJohns Hopkins\b/i, 'Johns Hopkins University'],
  [/\bUniversity of Melbourne\b|\bMelbourne\b/i, 'University of Melbourne'],
  [/\bBocconi\b/i, 'Bocconi University'],
  [/\bUniversity of Colorado\b|\bCU Boulder\b/i, 'University of Colorado Boulder'],
  [/\bETH Zurich\b|\bETH\b/i, 'ETH Zurich'],
  [/\bTsinghua\b/i, 'Tsinghua University'],
  [/\bOxford\b/i, 'University of Oxford'],
  [/\bCambridge\b/i, 'University of Cambridge'],
  [/\bCarnegie Mellon\b|\bCMU\b/i, 'Carnegie Mellon University'],
  [/\bDuke University\b|\bDuke\b/i, 'Duke University'],
  [/\bYale\b/i, 'Yale University'],
  [/\bCaltech\b/i, 'Caltech'],
  [/\bGeorgia Tech\b|\bGeorgia Institute\b/i, 'Georgia Tech'],
  [/\bBrown University\b|\bBrown\b/i, 'Brown University'],
  [/\bNorthwestern\b/i, 'Northwestern University'],
  [/\bNYU\b|\bNew York University\b/i, 'New York University'],
  [/\bUniversity of Illinois\b|\bUIUC\b/i, 'University of Illinois'],
  [/\bUniversity of Texas\b|\bUT Austin\b/i, 'University of Texas'],
  [/\bUniversity of Chicago\b|\bUChicago\b/i, 'University of Chicago'],
  [/\bLSE\b|\bLondon School of Economics\b/i, 'London School of Economics'],
  [/\bUBC\b|\bUniversity of British Columbia\b/i, 'University of British Columbia'],
  [/\bNanyang\b|\bNTU\b/i, 'Nanyang Technological University'],
  [/\bSeoul National\b/i, 'Seoul National University'],
  [/\bUniversity of Hong Kong\b|\bHKU\b/i, 'University of Hong Kong'],
  [/\bTechnion\b/i, 'Technion'],
  [/\bHebrew University\b/i, 'Hebrew University'],
]

/**
 * Fuzzy-match a university name from raw founders data to a known logo.
 * Handles messy entries like "Stanford University with focus on signal processing and AI".
 * Returns the Clearbit logo URL or null if no match.
 */
export function getUniversityLogo(name: string): string | null {
  // Exact match first
  if (UNIVERSITY_LOGOS[name]) return UNIVERSITY_LOGOS[name]

  // Fuzzy match via patterns
  for (const [pattern, canonicalName] of FUZZY_PATTERNS) {
    if (pattern.test(name)) {
      return UNIVERSITY_LOGOS[canonicalName] || null
    }
  }

  return null
}

/**
 * Normalize a university name to its canonical form for aggregation.
 * Returns the canonical name or the original if no match.
 */
export function normalizeUniversityName(name: string): string {
  // Exact match
  if (UNIVERSITY_LOGOS[name]) return name

  // Fuzzy match
  for (const [pattern, canonicalName] of FUZZY_PATTERNS) {
    if (pattern.test(name)) return canonicalName
  }

  return name
}
