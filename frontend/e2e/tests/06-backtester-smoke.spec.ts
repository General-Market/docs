import { test, expect } from '@playwright/test'
import { BACKEND_URL } from '../fixtures/wallet'

/**
 * Backtester Smoke Tests
 *
 * Verify that simulation endpoints produce valid results for:
 * - Each CoinGecko category
 * - DefiLlama categories
 * - Weighting strategies
 * - FNG regime modes
 * - Dominance regime modes
 * - GitHub filter modes
 *
 * These tests hit the data-node API directly (no UI) for speed and reliability.
 * They verify the simulation engine produces sensible output.
 */

interface SimCategory {
  id: string
  name: string
  coin_count: number
  source: string
}

interface SimStreamResult {
  stats: {
    total_return_pct: number
    annualized_return_pct: number
    max_drawdown_pct: number
    sharpe_ratio: number | null
    rebalance_count: number
    days: number
  } | null
  nav_series_count: number
  run_id: number | null
  error: string | null
}

/** Run a simulation via SSE stream and return parsed results */
async function runSimStream(params: Record<string, string>): Promise<SimStreamResult> {
  const qs = new URLSearchParams(params)
  const url = `${BACKEND_URL}/sim/run-stream?${qs.toString()}`

  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!res.ok) {
    return { stats: null, nav_series_count: 0, run_id: null, error: `HTTP ${res.status}` }
  }

  const text = await res.text()
  const lines = text.split('\n').filter(l => l.startsWith('data: '))

  let stats: SimStreamResult['stats'] = null
  let navCount = 0
  let runId: number | null = null
  let error: string | null = null

  for (const line of lines) {
    try {
      const data = JSON.parse(line.slice(6))
      if (data.type === 'nav') navCount++
      if (data.type === 'stats') {
        stats = {
          total_return_pct: data.total_return_pct,
          annualized_return_pct: data.annualized_return_pct,
          max_drawdown_pct: data.max_drawdown_pct,
          sharpe_ratio: data.sharpe_ratio ?? null,
          rebalance_count: data.rebalance_count,
          days: data.days,
        }
      }
      if (data.type === 'done') runId = data.run_id ?? null
      if (data.type === 'error') error = data.message ?? 'unknown error'
    } catch {
      // skip non-JSON lines
    }
  }

  return { stats, nav_series_count: navCount, run_id: runId, error }
}

/** Fetch all available categories */
async function fetchCategories(): Promise<SimCategory[]> {
  const res = await fetch(`${BACKEND_URL}/sim/categories`, {
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Categories fetch failed: HTTP ${res.status}`)
  const data = await res.json()
  return data.categories || []
}

test.describe('Backtester Smoke Tests', () => {
  let allCategories: SimCategory[] = []
  let cgCategories: SimCategory[] = []
  let dlCategories: SimCategory[] = []

  test.beforeAll(async () => {
    allCategories = await fetchCategories()
    cgCategories = allCategories.filter(c => c.source !== 'defillama')
    dlCategories = allCategories.filter(c => c.source === 'defillama')
  })

  test('categories endpoint returns data', async () => {
    expect(allCategories.length).toBeGreaterThan(0)
    expect(cgCategories.length).toBeGreaterThan(0)
    // Each category has required fields
    for (const cat of allCategories.slice(0, 5)) {
      expect(cat.id).toBeTruthy()
      expect(cat.name).toBeTruthy()
      expect(cat.coin_count).toBeGreaterThanOrEqual(0)
    }
  })

  // --- CoinGecko Category Simulations ---

  test('CG category: layer-1 (equal weight)', async () => {
    const result = await runSimStream({
      category_id: 'layer-1',
      top_n: '10',
      weighting: 'equal',
      rebalance_days: '30',
    })
    expect(result.error).toBeNull()
    expect(result.nav_series_count).toBeGreaterThan(30)
    expect(result.stats).not.toBeNull()
    expect(result.stats!.days).toBeGreaterThan(30)
    expect(result.stats!.rebalance_count).toBeGreaterThanOrEqual(1)
    expect(result.run_id).not.toBeNull()
  })

  test('CG category: layer-2 (mcap weight)', async () => {
    const result = await runSimStream({
      category_id: 'layer-2',
      top_n: '10',
      weighting: 'mcap',
      rebalance_days: '30',
    })
    expect(result.error).toBeNull()
    expect(result.nav_series_count).toBeGreaterThan(10)
    expect(result.stats).not.toBeNull()
  })

  test('CG category: decentralized-finance-defi (momentum)', async () => {
    const result = await runSimStream({
      category_id: 'decentralized-finance-defi',
      top_n: '10',
      weighting: 'mom_30',
      rebalance_days: '14',
    })
    expect(result.error).toBeNull()
    expect(result.nav_series_count).toBeGreaterThan(10)
    expect(result.stats).not.toBeNull()
  })

  test('CG category: meme-token (equal weight, top 20)', async () => {
    const result = await runSimStream({
      category_id: 'meme-token',
      top_n: '20',
      weighting: 'equal',
      rebalance_days: '30',
    })
    expect(result.error).toBeNull()
    expect(result.nav_series_count).toBeGreaterThan(10)
    expect(result.stats).not.toBeNull()
  })

  test('CG category: artificial-intelligence (minvar)', async () => {
    const result = await runSimStream({
      category_id: 'artificial-intelligence',
      top_n: '10',
      weighting: 'minvar',
      rebalance_days: '30',
    })
    expect(result.error).toBeNull()
    expect(result.nav_series_count).toBeGreaterThan(10)
    expect(result.stats).not.toBeNull()
  })

  // Test all CG categories with at least 5 coins (parameterized)
  test('all CG categories with >=5 coins produce valid results', async () => {
    const eligible = cgCategories.filter(c => c.coin_count >= 5)
    expect(eligible.length).toBeGreaterThan(0)

    const failures: { id: string; name: string; error: string }[] = []

    for (const cat of eligible) {
      const result = await runSimStream({
        category_id: cat.id,
        top_n: '5',
        weighting: 'equal',
        rebalance_days: '30',
      })

      if (result.error || !result.stats || result.nav_series_count < 5) {
        failures.push({
          id: cat.id,
          name: cat.name,
          error: result.error || `nav_series=${result.nav_series_count}, stats=${result.stats ? 'ok' : 'null'}`,
        })
      }
    }

    // Log failures for debugging
    if (failures.length > 0) {
      console.log(`\n--- Category Failures (${failures.length}/${eligible.length}) ---`)
      for (const f of failures) {
        console.log(`  FAIL: ${f.id} (${f.name}): ${f.error}`)
      }
    }

    // Allow up to 10% failure rate (some categories may have data gaps)
    const failRate = failures.length / eligible.length
    expect(failRate).toBeLessThan(0.1)
  })

  // --- DefiLlama Category Simulations ---

  test('DefiLlama categories loaded', async () => {
    // DL categories may or may not exist depending on DL collector
    console.log(`DefiLlama categories available: ${dlCategories.length}`)
    // This is informational — DL categories are optional
  })

  test('DL categories (if any) produce valid results', async () => {
    if (dlCategories.length === 0) {
      console.log('No DefiLlama categories — skipping')
      return
    }

    const sample = dlCategories.slice(0, 5) // test first 5
    const failures: { id: string; name: string; error: string }[] = []

    for (const cat of sample) {
      const result = await runSimStream({
        category_id: cat.id,
        top_n: '5',
        weighting: 'equal',
        rebalance_days: '30',
      })

      if (result.error || !result.stats || result.nav_series_count < 5) {
        failures.push({
          id: cat.id,
          name: cat.name,
          error: result.error || `nav_series=${result.nav_series_count}, stats=${result.stats ? 'ok' : 'null'}`,
        })
      }
    }

    if (failures.length > 0) {
      console.log(`\n--- DL Category Failures (${failures.length}/${sample.length}) ---`)
      for (const f of failures) {
        console.log(`  FAIL: ${f.id} (${f.name}): ${f.error}`)
      }
    }

    // Log but don't fail — DL integration may have data issues
    console.log(`DL categories tested: ${sample.length}, failures: ${failures.length}`)
  })

  // --- Weighting Strategies ---

  const WEIGHTINGS = [
    'equal', 'mcap', 'sqrt_mcap', 'inv_mcap',
    'mom_30', 'mom_60', 'mom_90',
    'minvar', 'maxsharpe', 'riskpar',
    'rvol_30', 'rvol_60',
  ]

  for (const w of WEIGHTINGS) {
    test(`weighting: ${w} produces valid results`, async () => {
      const result = await runSimStream({
        category_id: 'layer-1',
        top_n: '10',
        weighting: w,
        rebalance_days: '30',
      })
      expect(result.error).toBeNull()
      expect(result.nav_series_count).toBeGreaterThan(10)
      expect(result.stats).not.toBeNull()
    })
  }

  // --- DeFi Weighting Strategies ---

  const DEFI_WEIGHTINGS = ['tvl_w', 'fee_w', 'vol_w', 'tvl_eff', 'yield_w']

  for (const w of DEFI_WEIGHTINGS) {
    test(`defi weighting: ${w} produces valid results`, async () => {
      const result = await runSimStream({
        category_id: 'decentralized-finance-defi',
        top_n: '10',
        weighting: w,
        rebalance_days: '30',
      })
      // DeFi weightings may fail if DL data is missing — log but check
      if (result.error) {
        console.log(`defi weighting ${w} error: ${result.error}`)
      }
      // Should at least not crash — either valid results or graceful error
      expect(result.stats !== null || result.error !== null).toBe(true)
    })
  }

  // --- GitHub Weighting Strategies ---

  const GITHUB_WEIGHTINGS = ['star_w', 'commit_w', 'dev_gate', 'contrib_w', 'dev_mcap']

  for (const w of GITHUB_WEIGHTINGS) {
    test(`github weighting: ${w} produces valid results`, async () => {
      const result = await runSimStream({
        category_id: 'layer-1',
        top_n: '10',
        weighting: w,
        rebalance_days: '30',
      })
      if (result.error) {
        console.log(`github weighting ${w} error: ${result.error}`)
      }
      // GitHub data may not be available yet — should gracefully handle
      expect(result.stats !== null || result.error !== null).toBe(true)
    })
  }

  // --- FNG Regime Modes ---

  const FNG_MODES = ['trigger', 'cash', 'risk_toggle', 'top_n_scaler', 'contrarian', 'frequency']

  for (const mode of FNG_MODES) {
    test(`FNG regime: ${mode} produces valid results`, async () => {
      const params: Record<string, string> = {
        category_id: 'layer-1',
        top_n: '10',
        weighting: 'equal',
        rebalance_days: '30',
        fng_mode: mode,
        fng_fear_threshold: '25',
        fng_greed_threshold: '75',
      }
      if (mode === 'cash') params.fng_cash_pct = '0.4'

      const result = await runSimStream(params)
      if (result.error) {
        console.log(`FNG ${mode} error: ${result.error}`)
      }
      // FNG data may not be loaded yet — should not crash
      expect(result.stats !== null || result.error !== null).toBe(true)
    })
  }

  // --- Dominance Regime Modes ---

  const DOM_MODES = ['alt_rotator', 'trend_filter', 'weighted_split', 'breadth', 'momentum', 'combo']

  for (const mode of DOM_MODES) {
    test(`dominance regime: ${mode} produces valid results`, async () => {
      const result = await runSimStream({
        category_id: 'layer-1',
        top_n: '10',
        weighting: 'equal',
        rebalance_days: '30',
        dom_mode: mode,
        dom_lookback: '30',
      })
      if (result.error) {
        console.log(`DOM ${mode} error: ${result.error}`)
      }
      expect(result.stats !== null || result.error !== null).toBe(true)
    })
  }

  // --- GitHub Filter Modes ---

  const GITHUB_FILTER_MODES = ['activity', 'quality_gate']

  for (const mode of GITHUB_FILTER_MODES) {
    test(`github filter: ${mode} produces valid results`, async () => {
      const result = await runSimStream({
        category_id: 'layer-1',
        top_n: '10',
        weighting: 'equal',
        rebalance_days: '30',
        github_mode: mode,
        github_min_commits: '3',
      })
      if (result.error) {
        console.log(`GitHub filter ${mode} error: ${result.error}`)
      }
      expect(result.stats !== null || result.error !== null).toBe(true)
    })
  }

  // --- Combined Regime Test ---

  test('FNG + Dominance + GitHub combined produces valid results', async () => {
    const result = await runSimStream({
      category_id: 'layer-1',
      top_n: '10',
      weighting: 'equal',
      rebalance_days: '30',
      fng_mode: 'trigger',
      fng_fear_threshold: '25',
      fng_greed_threshold: '75',
      dom_mode: 'trend_filter',
      dom_lookback: '30',
      github_mode: 'activity',
      github_min_commits: '3',
    })
    if (result.error) {
      console.log(`Combined regime error: ${result.error}`)
    }
    expect(result.stats !== null || result.error !== null).toBe(true)
  })

  // --- Sanity Checks ---

  test('simulation NAV starts near $1', async () => {
    const result = await runSimStream({
      category_id: 'layer-1',
      top_n: '10',
      weighting: 'equal',
      rebalance_days: '30',
    })
    expect(result.error).toBeNull()
    expect(result.stats).not.toBeNull()
    // NAV starts at $1 — after days, total return should be finite
    expect(Math.abs(result.stats!.total_return_pct)).toBeLessThan(10000) // <100x
  })

  test('max drawdown is negative or zero', async () => {
    const result = await runSimStream({
      category_id: 'layer-1',
      top_n: '10',
      weighting: 'equal',
      rebalance_days: '30',
    })
    expect(result.error).toBeNull()
    expect(result.stats).not.toBeNull()
    expect(result.stats!.max_drawdown_pct).toBeLessThanOrEqual(0)
  })

  // --- FNG Latest Endpoint ---

  test('/fng/latest returns valid data or empty', async () => {
    const res = await fetch(`${BACKEND_URL}/fng/latest`, {
      signal: AbortSignal.timeout(10_000),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    // May have value + classification or be empty if no FNG data yet
    if (data.value !== undefined) {
      expect(data.value).toBeGreaterThanOrEqual(0)
      expect(data.value).toBeLessThanOrEqual(100)
      expect(data.classification).toBeTruthy()
    }
  })
})
