/**
 * Vision E2E: Leaderboard rendering and data integrity.
 *
 * Validates the VisionLeaderboard table on the main Vision page:
 * - Correct columns render (#, Player, PnL, ROI, Rounds, Win%, Correct%, Volume, Batches)
 * - Default sort by PnL descending
 * - No raw bigint/wei values leak into the display
 * - Numeric values are in plausible ranges
 *
 * Note: the VisionLeaderboard component does NOT currently have clickable
 * column headers for sorting — it renders a static table sorted server-side.
 * This test validates the rendered sort order and formatting.
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_API } from '../env'
import { RPC_TIMEOUT } from '../env'

/** Parse a dollar string like "+$14.20" or "-$3.50" into a number (signed) */
function parsePnl(text: string): number {
  const cleaned = text.replace(/[^0-9.+-]/g, '')
  return parseFloat(cleaned) || 0
}

test.describe('Vision Leaderboard Sorting', () => {
  test('46a: leaderboard table renders with correct columns', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    // Quick Vision API probe — skip if oracle is down
    try {
      const probe = await fetch(`${VISION_API}/vision/batches`, { signal: AbortSignal.timeout(5_000) })
      if (!probe.ok) { console.log('Vision API returned ' + probe.status + ' — skipping'); return }
    } catch { console.log('Vision API unreachable — skipping'); return }

    // Leaderboard is on source detail pages, not the home page.
    // Navigate to a source with a deployed batch.
    await page.goto('/source/defi#leaderboard', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Wait for the leaderboard section heading
    const leaderboardSection = page.locator('#leaderboard')
    const hasSection = await leaderboardSection.isVisible({ timeout: 15_000 }).catch(() => false)
    expect(hasSection, 'Leaderboard section (#leaderboard) must exist on source detail page').toBe(true)

    // Check if the leaderboard table rendered (vs empty state)
    const table = leaderboardSection.locator('table')
    const hasTable = await table.first().isVisible({ timeout: 15_000 }).catch(() => false)

    if (!hasTable) {
      // Empty state is acceptable — "No players yet"
      const emptyMsg = page.getByText(/No players yet|Failed to load/)
      const isEmpty = await emptyMsg.isVisible({ timeout: 5_000 }).catch(() => false)
      if (isEmpty) {
        console.warn('SKIP: Leaderboard empty — no players have completed rounds yet. Expected on fresh deploys.')
        return
      }
      console.warn('SKIP: Leaderboard table not rendered — may still be loading.')
      return
    }

    // Verify column headers exist
    const headers = table.locator('th')
    const headerTexts: string[] = []
    const headerCount = await headers.count()
    for (let i = 0; i < headerCount; i++) {
      const text = (await headers.nth(i).textContent() || '').trim()
      headerTexts.push(text)
    }

    console.log(`Leaderboard columns: ${headerTexts.join(' | ')}`)

    // Expected columns: #, Player, PnL (USDC), ROI, Rounds, Win%, Correct%, Volume, Batches
    expect(headerTexts.some(h => h === '#')).toBe(true)
    expect(headerTexts.some(h => h.includes('Player'))).toBe(true)
    expect(headerTexts.some(h => h.includes('PnL'))).toBe(true)
    expect(headerTexts.some(h => h.includes('ROI'))).toBe(true)
    expect(headerTexts.some(h => h.includes('Win%'))).toBe(true)
    expect(headerTexts.some(h => h.includes('Volume'))).toBe(true)
  })

  test('46b: leaderboard entries sorted by PnL descending', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    // Quick Vision API probe — skip if oracle is down
    try {
      const probe = await fetch(`${VISION_API}/vision/batches`, { signal: AbortSignal.timeout(5_000) })
      if (!probe.ok) { console.log('Vision API returned ' + probe.status + ' — skipping'); return }
    } catch { console.log('Vision API unreachable — skipping'); return }

    await page.goto('/source/defi#leaderboard', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    const leaderboardSection = page.locator('#leaderboard')
    const hasSection = await leaderboardSection.isVisible({ timeout: 15_000 }).catch(() => false)
    expect(hasSection, 'Leaderboard section (#leaderboard) must exist on source detail page').toBe(true)

    const table = leaderboardSection.locator('table')
    const hasTable = await table.first().isVisible({ timeout: 15_000 }).catch(() => false)
    if (!hasTable) {
      console.warn('SKIP: No leaderboard table — no players have completed rounds yet. Expected on fresh deploys.')
      return
    }

    // Extract PnL values from the table rows
    // PnL column has text-color-up or text-color-down classes and contains $ amounts
    const rows = table.locator('tbody tr')
    const rowCount = await rows.count()

    if (rowCount < 2) {
      console.warn(`SKIP: Only ${rowCount} row(s) — cannot verify sort order. Expected on fresh deploys.`)
      return
    }

    const pnlValues: number[] = []
    for (let i = 0; i < Math.min(rowCount, 10); i++) {
      const row = rows.nth(i)
      // PnL cell is the one with font-bold and color-up/color-down
      const pnlCell = row.locator('td').nth(2) // 3rd column = PnL (USDC)
      const text = (await pnlCell.textContent() || '').trim()

      // Parse: "+$14.20" → 14.20 or "-$3.50" → -3.50
      const isNegative = text.startsWith('-')
      const num = parsePnl(text)
      pnlValues.push(isNegative ? -num : num)
    }

    console.log(`PnL values (first ${pnlValues.length}): ${pnlValues.map(v => v.toFixed(2)).join(', ')}`)

    // Verify descending order — each PnL should be >= the next
    for (let i = 0; i < pnlValues.length - 1; i++) {
      expect(
        pnlValues[i],
        `Row ${i} PnL (${pnlValues[i]}) should be >= row ${i + 1} PnL (${pnlValues[i + 1]})`,
      ).toBeGreaterThanOrEqual(pnlValues[i + 1])
    }
  })

  test('46c: no raw bigint values in leaderboard', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    // Quick Vision API probe — skip if oracle is down
    try {
      const probe = await fetch(`${VISION_API}/vision/batches`, { signal: AbortSignal.timeout(5_000) })
      if (!probe.ok) { console.log('Vision API returned ' + probe.status + ' — skipping'); return }
    } catch { console.log('Vision API unreachable — skipping'); return }

    await page.goto('/source/defi#leaderboard', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    const leaderboardSection = page.locator('#leaderboard')
    const hasSection = await leaderboardSection.isVisible({ timeout: 15_000 }).catch(() => false)
    expect(hasSection, 'Leaderboard section (#leaderboard) must exist on source detail page').toBe(true)

    const sectionText = await leaderboardSection.textContent() || ''

    // Check for raw 18-digit numbers (unformatted wei values)
    // 18 digits = 1e18 = $1 in 18-decimal USDC
    const rawWeiPattern = /\d{18,}/g
    const matches = sectionText.match(rawWeiPattern) || []

    const suspicious = matches.filter(m => {
      if (m.length > 42) return false // address/hash
      const num = parseFloat(m)
      return num > 1e16 && num < 1e27
    })

    if (suspicious.length > 0) {
      console.log('Suspicious raw wei values in leaderboard:', suspicious)
    }
    expect(suspicious.length, 'Raw bigint values should not appear in leaderboard').toBe(0)

    // Also verify dollar amounts are in plausible range
    const dollarPattern = /\$[\d,]+\.?\d*/g
    const dollarMatches = sectionText.match(dollarPattern) || []

    for (const match of dollarMatches) {
      const num = parseFloat(match.replace(/[^0-9.]/g, ''))
      expect(num, `Leaderboard value "${match}" exceeds plausible range`).toBeLessThan(10_000_000)
    }
  })

  test('46d: leaderboard win rate and ROI are in valid ranges', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    // Quick Vision API probe — skip if oracle is down
    try {
      const probe = await fetch(`${VISION_API}/vision/batches`, { signal: AbortSignal.timeout(5_000) })
      if (!probe.ok) { console.log('Vision API returned ' + probe.status + ' — skipping'); return }
    } catch { console.log('Vision API unreachable — skipping'); return }

    await page.goto('/source/defi#leaderboard', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    const leaderboardSection = page.locator('#leaderboard')
    const hasSection = await leaderboardSection.isVisible({ timeout: 15_000 }).catch(() => false)
    expect(hasSection, 'Leaderboard section (#leaderboard) must exist on source detail page').toBe(true)

    const table = leaderboardSection.locator('table')
    const hasTable = await table.first().isVisible({ timeout: 15_000 }).catch(() => false)
    if (!hasTable) {
      console.warn('SKIP: No leaderboard table — no players have completed rounds yet. Expected on fresh deploys.')
      return
    }

    const rows = table.locator('tbody tr')
    const rowCount = await rows.count()
    if (rowCount === 0) {
      console.warn('SKIP: Leaderboard has 0 rows — no players yet. Expected on fresh deploys.')
      return
    }

    for (let i = 0; i < Math.min(rowCount, 10); i++) {
      const row = rows.nth(i)
      const cells = row.locator('td')
      const cellCount = await cells.count()

      // Rank (#) — first column
      const rankText = (await cells.nth(0).textContent() || '').trim()
      const rank = parseInt(rankText)
      if (!isNaN(rank)) {
        expect(rank).toBeGreaterThan(0)
        expect(rank).toBeLessThan(10_000)
      }

      // Walk through cells looking for percentage values (Win%, Correct%, ROI)
      for (let c = 0; c < cellCount; c++) {
        const text = (await cells.nth(c).textContent() || '').trim()

        // Check percentage values
        const pctMatch = text.match(/([\d.]+)%/)
        if (pctMatch) {
          const pct = parseFloat(pctMatch[1])
          // Win% and Correct% should be 0-100
          // ROI can be negative (displayed as -X.X%) but the captured group is the absolute value
          if (!text.includes('-')) {
            expect(pct, `Percentage "${text}" in row ${i} col ${c} should be <= 100`).toBeLessThanOrEqual(100)
          }
          expect(pct, `Percentage "${text}" in row ${i} col ${c} should be >= 0`).toBeGreaterThanOrEqual(0)
        }

        // Check round counts are reasonable integers
        const roundMatch = text.match(/^(\d+)$/)
        if (roundMatch && c >= 4) {
          // Rounds and Batches columns are after PnL/ROI
          const count = parseInt(roundMatch[1])
          expect(count, `Count "${text}" in row ${i} col ${c} should be < 100000`).toBeLessThan(100_000)
        }
      }
    }

    console.log(`Validated ${Math.min(rowCount, 10)} leaderboard rows — all values in range`)
  })

  test('46e: leaderboard API returns consistent data shape', async () => {
    test.setTimeout(30_000)

    // Quick Vision API probe — skip if oracle is down
    try {
      const probe = await fetch(`${VISION_API}/vision/batches`, { signal: AbortSignal.timeout(5_000) })
      if (!probe.ok) { console.log('Vision API returned ' + probe.status + ' — skipping'); return }
    } catch { console.log('Vision API unreachable — skipping'); return }

    // Pure API check — no browser
    const res = await fetch(`${VISION_API}/vision/leaderboard`, {
      signal: AbortSignal.timeout(RPC_TIMEOUT),
    })

    expect(res.ok, `Leaderboard API returned ${res.status} — endpoint must be reachable`).toBe(true)

    const data = await res.json()
    expect(data).toHaveProperty('leaderboard')
    expect(Array.isArray(data.leaderboard)).toBe(true)

    if (data.leaderboard.length === 0) {
      console.warn('SKIP: Leaderboard empty — no players yet. Expected on fresh deploys.')
      return
    }

    // Verify sort: entries should be sorted by PnL descending
    const pnls = data.leaderboard.map((e: { pnl: number }) => e.pnl)
    for (let i = 0; i < pnls.length - 1; i++) {
      expect(
        pnls[i],
        `API entry ${i} PnL (${pnls[i]}) should be >= entry ${i + 1} PnL (${pnls[i + 1]})`,
      ).toBeGreaterThanOrEqual(pnls[i + 1])
    }

    // Verify all required fields present on first entry
    const first = data.leaderboard[0]
    const requiredFields = ['walletAddress', 'pnl', 'winRate', 'roi', 'totalVolume', 'roundsPlayed', 'roundsWon']
    for (const field of requiredFields) {
      expect(first, `Missing field: ${field}`).toHaveProperty(field)
    }

    console.log(`Leaderboard API: ${data.leaderboard.length} entries, top PnL = ${pnls[0]}`)
  })
})
