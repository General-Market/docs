import { describe, test, expect } from 'bun:test'
import {
  PAIR_REGISTRY,
  pairById,
  pairsForBoard,
  type PvpPair,
} from '../pairs'

describe('pairById', () => {
  test('returns the pair for a valid stars index (1..15)', () => {
    const p = pairById(1)
    expect(p).toBeDefined()
    expect(p!.pairIndex).toBe(1)
    expect(p!.board).toBe('stars')
    expect(p!.sourceId).toBe(1)
  })

  test('returns the pair for a valid cams index (16..25)', () => {
    const p = pairById(16)
    expect(p).toBeDefined()
    expect(p!.pairIndex).toBe(16)
    expect(p!.board).toBe('cams')
    expect(p!.sourceId).toBe(4)
  })

  test('returns the pair for the upper-bound cams index (25)', () => {
    const p = pairById(25)
    expect(p).toBeDefined()
    expect(p!.pairIndex).toBe(25)
    expect(p!.board).toBe('cams')
  })

  test('returns undefined for an out-of-range index (0)', () => {
    expect(pairById(0)).toBeUndefined()
  })

  test('returns undefined for an out-of-range index (26)', () => {
    expect(pairById(26)).toBeUndefined()
  })

  test('returns undefined for negative index', () => {
    expect(pairById(-1)).toBeUndefined()
  })

  test('every registry entry is retrievable by its pairIndex', () => {
    for (const p of PAIR_REGISTRY) {
      expect(pairById(p.pairIndex)).toEqual(p as PvpPair)
    }
  })
})

describe('pairsForBoard', () => {
  test('stars filter returns 15 pairs', () => {
    const stars = pairsForBoard('stars')
    expect(stars).toHaveLength(15)
    expect(stars.every(p => p.board === 'stars')).toBe(true)
    expect(stars.every(p => p.sourceId === 1)).toBe(true)
  })

  test('cams filter returns 10 pairs', () => {
    const cams = pairsForBoard('cams')
    expect(cams).toHaveLength(10)
    expect(cams.every(p => p.board === 'cams')).toBe(true)
    expect(cams.every(p => p.sourceId === 4)).toBe(true)
  })

  test('all returns 25 pairs (15 stars + 10 cams)', () => {
    const all = pairsForBoard('all')
    expect(all).toHaveLength(25)
    expect(all.filter(p => p.board === 'stars')).toHaveLength(15)
    expect(all.filter(p => p.board === 'cams')).toHaveLength(10)
  })

  test('all returns a fresh slice — mutating the result does not corrupt the registry', () => {
    const a = pairsForBoard('all')
    const beforeLen = PAIR_REGISTRY.length
    a.pop()
    expect(PAIR_REGISTRY).toHaveLength(beforeLen)
  })

  test('stars indices are 1..15 contiguous', () => {
    const stars = pairsForBoard('stars')
    const indices = stars.map(p => p.pairIndex).sort((a, b) => a - b)
    expect(indices).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
  })

  test('cams indices are 16..25 contiguous', () => {
    const cams = pairsForBoard('cams')
    const indices = cams.map(p => p.pairIndex).sort((a, b) => a - b)
    expect(indices).toEqual(Array.from({ length: 10 }, (_, i) => i + 16))
  })
})
