import { describe, test, expect } from 'bun:test'
import { toInternalId, toBatchSourceId } from './source-ids'

describe('toBatchSourceId', () => {
  test('curated subsource settles under its batchSubsourceKey, not the parent id', () => {
    // defillama-ai-agents shares the `defi` firehose for prices, but its
    // batches/settlements are keyed by the subsource key in vision_settlements.
    expect(toInternalId('defillama-ai-agents')).toBe('defi')
    expect(toBatchSourceId('defillama-ai-agents')).toBe('defillama-ai-agents')
    expect(toBatchSourceId('defillama-derivatives')).toBe('defillama-derivatives')
  })

  test('non-curated source falls back to the data-node internal id', () => {
    // coingecko ingests under `crypto`; its batches settle under the same id.
    expect(toBatchSourceId('coingecko')).toBe(toInternalId('coingecko'))
    expect(toBatchSourceId('coingecko')).toBe('crypto')
  })

  test('unknown source returns itself', () => {
    expect(toBatchSourceId('does-not-exist')).toBe('does-not-exist')
  })
})
