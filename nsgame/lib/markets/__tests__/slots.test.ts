import { describe, test, expect } from 'bun:test'
import { PublicKey } from '@solana/web3.js'
import { generateSlots, deriveMarketPdaSync } from '../slots'
import type { CatalogEntry } from '../catalog'

const PROGRAM_ID = new PublicKey('DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA')

function makeEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'test_entry',
    sourceId: 1,
    sourceName: 'tubes_xv',
    pairIndex: 1,
    thresholdBps: 1,
    closeOffsetSecs: 14_400,
    settleOffsetSecs: 14_460,
    label: 'A vs B',
    description: '—',
    board: 'stars',
    format: 'f1-gain-race',
    displayA: 'A',
    displayB: 'B',
    slugA: 'a',
    slugB: 'b',
    audienceA: 100n,
    audienceB: 100n,
    tightness: 0.9,
    windowSecs: 14_400,
    ...overrides,
  }
}

describe('generateSlots', () => {
  test('snaps closeTime to the 60s grid (cohort end aligns to windowSecs)', () => {
    // Cohort-based: closeTime = floor(now / windowSecs) * windowSecs + windowSecs.
    // For windowSecs=14400 (a multiple of 60), the result is always grid-aligned.
    const nowSecs = 1_700_000_037 // off-grid on purpose
    const slots = generateSlots({
      catalog: [makeEntry({ windowSecs: 14_400 })],
      nowSecs,
      horizonDays: 1,
      programId: PROGRAM_ID,
    })
    expect(slots).toHaveLength(1)
    const close = slots[0]!.closeTime
    expect(close % 60).toBe(0)
    const expected = Math.floor(nowSecs / 14_400) * 14_400 + 14_400
    expect(close).toBe(expected)
    // settle = close + (settleOffset - closeOffset) = close + 60 (default fixture)
    expect(slots[0]!.settlementTime).toBe(close + 60)
  })

  test('filters by board — stars only excludes cams entries', () => {
    const stars = makeEntry({ id: 's', board: 'stars', sourceId: 1, windowSecs: 14_400 })
    const cams = makeEntry({
      id: 'c', board: 'cams', sourceId: 4, windowSecs: 120,
      closeOffsetSecs: 120, settleOffsetSecs: 150,
    })
    const slots = generateSlots({
      catalog: [stars, cams],
      nowSecs: 1_700_000_000,
      horizonDays: 1,
      programId: PROGRAM_ID,
      board: 'stars',
    })
    expect(slots.length).toBeGreaterThan(0)
    expect(slots.every(s => s.board === 'stars')).toBe(true)
  })

  test('filters by board — cams only excludes stars entries', () => {
    const stars = makeEntry({ id: 's', board: 'stars', sourceId: 1, windowSecs: 14_400 })
    const cams = makeEntry({
      id: 'c', board: 'cams', sourceId: 4, windowSecs: 120,
      closeOffsetSecs: 120, settleOffsetSecs: 150,
    })
    const slots = generateSlots({
      catalog: [stars, cams],
      nowSecs: 1_700_000_000,
      horizonDays: 1,
      programId: PROGRAM_ID,
      board: 'cams',
    })
    expect(slots.length).toBeGreaterThan(0)
    expect(slots.every(s => s.board === 'cams')).toBe(true)
  })

  test('board=all returns both boards', () => {
    const stars = makeEntry({ id: 's', board: 'stars', sourceId: 1, windowSecs: 14_400 })
    const cams = makeEntry({
      id: 'c', board: 'cams', sourceId: 4, windowSecs: 120,
      closeOffsetSecs: 120, settleOffsetSecs: 150,
    })
    const slots = generateSlots({
      catalog: [stars, cams],
      nowSecs: 1_700_000_000,
      horizonDays: 1,
      programId: PROGRAM_ID,
      board: 'all',
    })
    const boards = new Set(slots.map(s => s.board))
    expect(boards.has('stars')).toBe(true)
    expect(boards.has('cams')).toBe(true)
  })

  test('empty catalog returns empty result', () => {
    const slots = generateSlots({
      catalog: [],
      nowSecs: 1_700_000_000,
      horizonDays: 7,
      programId: PROGRAM_ID,
    })
    expect(slots).toEqual([])
  })

  test('skips entries with windowSecs <= 0', () => {
    const slots = generateSlots({
      catalog: [makeEntry({ windowSecs: 0 })],
      nowSecs: 1_700_000_000,
      horizonDays: 1,
      programId: PROGRAM_ID,
    })
    expect(slots).toEqual([])
  })
})

describe('deriveMarketPdaSync — fixture parity with place-test-bet.ts', () => {
  // Inputs: source=3, threshold=1, close=1777115460, settle=1777115520.
  // Both `deriveMarketPdaSync` (frontend) and `place-test-bet.ts` (deploy
  // script) build the seeds the same way:
  //   [b"market", u32_le(source), i64_le(close), i64_le(settle), i32_le(threshold)]
  // so the PDA is byte-for-byte identical for identical inputs.
  test('produces deterministic PDA for known inputs', () => {
    const pda = deriveMarketPdaSync(PROGRAM_ID, {
      sourceId: 3,
      closeTime: 1_777_115_460,
      settlementTime: 1_777_115_520,
      thresholdBps: 1,
    })
    // Computed from this exact derivation against program id
    // DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA. If this string ever
    // shifts, either the derivation changed or the program id did — in
    // either case the on-chain compatibility broke.
    expect(pda.toBase58()).toBe('C7cA7MPnkFm2RykXGZPCL8cWw3WrzfPAumdufoftjc2e')
  })

  test('different threshold yields different PDA', () => {
    const a = deriveMarketPdaSync(PROGRAM_ID, {
      sourceId: 3, closeTime: 1_777_115_460, settlementTime: 1_777_115_520, thresholdBps: 1,
    })
    const b = deriveMarketPdaSync(PROGRAM_ID, {
      sourceId: 3, closeTime: 1_777_115_460, settlementTime: 1_777_115_520, thresholdBps: 2,
    })
    expect(a.toBase58()).not.toBe(b.toBase58())
  })

  test('different sourceId yields different PDA', () => {
    const a = deriveMarketPdaSync(PROGRAM_ID, {
      sourceId: 3, closeTime: 1_777_115_460, settlementTime: 1_777_115_520, thresholdBps: 1,
    })
    const b = deriveMarketPdaSync(PROGRAM_ID, {
      sourceId: 4, closeTime: 1_777_115_460, settlementTime: 1_777_115_520, thresholdBps: 1,
    })
    expect(a.toBase58()).not.toBe(b.toBase58())
  })

  test('generateSlots emits PDAs that match deriveMarketPdaSync directly', () => {
    const entry = makeEntry({
      sourceId: 3,
      thresholdBps: 1,
      windowSecs: 60,
      closeOffsetSecs: 60,
      settleOffsetSecs: 120,
    })
    const slots = generateSlots({
      catalog: [entry],
      nowSecs: 1_777_115_400,
      horizonDays: 1,
      programId: PROGRAM_ID,
    })
    expect(slots).toHaveLength(1)
    const expected = deriveMarketPdaSync(PROGRAM_ID, {
      sourceId: 3,
      closeTime: slots[0]!.closeTime,
      settlementTime: slots[0]!.settlementTime,
      thresholdBps: 1,
    })
    expect(slots[0]!.marketPda).toBe(expected.toBase58())
  })
})
