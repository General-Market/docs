/**
 * University logo mapping using Google Favicon API.
 * Maps university names (as they appear in founders data) to logo URLs.
 */

const favicon = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

export const UNIVERSITY_LOGOS: Record<string, string> = {
  'Stanford University': favicon('stanford.edu'),
  'University of Pennsylvania': favicon('upenn.edu'),
  'University of Waterloo': favicon('uwaterloo.ca'),
  'UCLA': favicon('ucla.edu'),
  'Peking University': favicon('pku.edu.cn'),
  'Princeton University': favicon('princeton.edu'),
  'University of Sydney': favicon('sydney.edu.au'),
  'UC Berkeley': favicon('berkeley.edu'),
  'University of Michigan': favicon('umich.edu'),
  'Columbia University': favicon('columbia.edu'),
  'Tel Aviv University': favicon('tau.ac.il'),
  'University of Notre Dame': favicon('nd.edu'),
  'Harvard University': favicon('harvard.edu'),
  'Shanghai Jiao Tong University': favicon('sjtu.edu.cn'),
  'University of Toronto': favicon('utoronto.ca'),
  'National University of Singapore': favicon('nus.edu.sg'),
  'University of Singapore': favicon('nus.edu.sg'),
  'Imperial College London': favicon('imperial.ac.uk'),
  'McGill University': favicon('mcgill.ca'),
  'MIT': favicon('mit.edu'),
  'University of Manchester': favicon('manchester.ac.uk'),
  'University of Washington': favicon('uw.edu'),
  'Cornell University': favicon('cornell.edu'),
  'University of Zurich': favicon('uzh.ch'),
  'Johns Hopkins University': favicon('jhu.edu'),
  'University of Melbourne': favicon('unimelb.edu.au'),
  'Bocconi University': favicon('unibocconi.eu'),
  'University of Colorado Boulder': favicon('colorado.edu'),
  'ETH Zurich': favicon('ethz.ch'),
  'Tsinghua University': favicon('tsinghua.edu.cn'),
  'University of Oxford': favicon('ox.ac.uk'),
  'University of Cambridge': favicon('cam.ac.uk'),
  'Carnegie Mellon University': favicon('cmu.edu'),
  'Duke University': favicon('duke.edu'),
  'Yale University': favicon('yale.edu'),
  'Caltech': favicon('caltech.edu'),
  'Georgia Tech': favicon('gatech.edu'),
  'Brown University': favicon('brown.edu'),
  'Northwestern University': favicon('northwestern.edu'),
  'New York University': favicon('nyu.edu'),
  'University of Illinois': favicon('illinois.edu'),
  'University of Texas': favicon('utexas.edu'),
  'University of Chicago': favicon('uchicago.edu'),
  'London School of Economics': favicon('lse.ac.uk'),
  'University of British Columbia': favicon('ubc.ca'),
  'Nanyang Technological University': favicon('ntu.edu.sg'),
  'Seoul National University': favicon('snu.ac.kr'),
  'University of Hong Kong': favicon('hku.hk'),
  'Technion': favicon('technion.ac.il'),
  'Hebrew University': favicon('huji.ac.il'),
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
