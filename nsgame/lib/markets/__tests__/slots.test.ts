import { describe, test, expect } from 'bun:test'
import { PublicKey } from '@solana/web3.js'
import { generateSlots, deriveMarketPdaSync } from '../slots'
import type { CatalogEntry } from '../catalog'
import { CATALOG } from '../catalog'

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
  test('snaps closeTime up to the 60s grid', () => {
    // nowSecs deliberately off-grid; closeOffsetSecs short so we stay in range
    const slots = generateSlots({
      catalog: [makeEntry({ closeOffsetSecs: 120, settleOffsetSecs: 180 })],
      nowSecs: 1_000_000_037, // not on a minute boundary
      horizonDays: 1,
      programId: PROGRAM_ID,
      maxSlotsPerEntry: 1,
    })
    expect(slots).toHaveLength(1)
    const close = slots[0]!.closeTime
    expect(close % 60).toBe(0)
    // First boundary is ceil((now + 120) / 60) * 60
    const expected = Math.ceil((1_000_000_037 + 120) / 60) * 60
    expect(close).toBe(expected)
    expect(slots[0]!.settlementTime).toBe(close + 60)
  })

  test('filters by board — stars only excludes cams entries', () => {
    const stars = makeEntry({ id: 's', board: 'stars', sourceId: 1 })
    const cams = makeEntry({ id: 'c', board: 'cams', sourceId: 4, closeOffsetSecs: 120, settleOffsetSecs: 150 })
    const slots = generateSlots({
      catalog: [stars, cams],
      nowSecs: 1_000_000_000,
      horizonDays: 1,
      programId: PROGRAM_ID,
      board: 'stars',
      maxSlotsPerEntry: 2,
    })
    expect(slots.every(s => s.board === 'stars')).toBe(true)
    expect(slots.length).toBeGreaterThan(0)
  })

  test('board=all returns both boards', () => {
    const stars = makeEntry({ id: 's', board: 'stars', sourceId: 1, closeOffsetSecs: 120, settleOffsetSecs: 180 })
    const cams = makeEntry({ id: 'c', board: 'cams', sourceId: 4, closeOffsetSecs: 120, settleOffsetSecs: 150 })
    const slots = generateSlots({
      catalog: [stars, cams],
      nowSecs: 1_000_000_000,
      horizonDays: 1,
      programId: PROGRAM_ID,
      board: 'all',
      maxSlotsPerEntry: 1,
    })
    const boards = new Set(slots.map(s => s.board))
    expect(boards.has('stars')).toBe(true)
    expect(boards.has('cams')).toBe(true)
  })

  test('honours maxSlotsPerEntry', () => {
    const slots = generateSlots({
      catalog: [makeEntry({ closeOffsetSecs: 60, settleOffsetSecs: 120 })],
      nowSecs: 1_000_000_000,
      horizonDays: 7,
      programId: PROGRAM_ID,
      maxSlotsPerEntry: 3,
    })
    expect(slots).toHaveLength(3)
  })

  test('empty catalog → empty result', () => {
    const slots = generateSlots({
      catalog: [],
      nowSecs: 1_000_000_000,
      horizonDays: 7,
      programId: PROGRAM_ID,
    })
    expect(slots).toEqual([])
  })

  test('result is sorted by closeTime ascending', () => {
    const slots = generateSlots({
      catalog: CATALOG,
      nowSecs: 1_700_000_000,
      horizonDays: 1,
      programId: PROGRAM_ID,
      maxSlotsPerEntry: 4,
    })
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i]!.closeTime).toBeGreaterThanOrEqual(slots[i - 1]!.closeTime)
    }
  })

  test('skips entries with closeOffsetSecs <= 0', () => {
    const slots = generateSlots({
      catalog: [makeEntry({ closeOffsetSecs: 0, settleOffsetSecs: 0 })],
      nowSecs: 1_000_000_000,
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
    // Computed from this exact derivation (program id =
    // DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA). If this string ever
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

  test('generateSlots PDAs match deriveMarketPdaSync directly', () => {
    const entry = makeEntry({
      sourceId: 3,
      thresholdBps: 1,
      closeOffsetSecs: 60,
      settleOffsetSecs: 120,
    })
    const nowSecs = 1_777_115_400 // 1777115460 - 60, on the minute
    const slots = generateSlots({
      catalog: [entry],
      nowSecs,
      horizonDays: 1,
      programId: PROGRAM_ID,
      maxSlotsPerEntry: 1,
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
