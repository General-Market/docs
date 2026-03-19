import { describe, test, expect } from 'bun:test'
import { getTxUrl, getAddressUrl, getContractUrl, getExplorerBaseUrl } from '../explorer'

const TX_HASH = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
const ADDRESS = '0x1234567890123456789012345678901234567890'

describe('getTxUrl', () => {
  test('returns # when L3 explorer is not configured', () => {
    // L3_EXPLORER_URL defaults to '' when env var is missing
    expect(getTxUrl(TX_HASH)).toBe('#')
  })

  test('generates settlement tx URL from config', () => {
    const url = getTxUrl(TX_HASH, 'settlement')
    expect(url).toContain('/tx/')
    expect(url).toContain(TX_HASH)
    expect(url).not.toBe('#')
  })
})

describe('getAddressUrl', () => {
  test('returns # when L3 explorer is not configured', () => {
    expect(getAddressUrl(ADDRESS)).toBe('#')
  })

  test('generates settlement address URL from config', () => {
    const url = getAddressUrl(ADDRESS, 'settlement')
    expect(url).toContain('/address/')
    expect(url).toContain(ADDRESS)
    expect(url).not.toBe('#')
  })
})

describe('getContractUrl', () => {
  test('returns # when L3 explorer is not configured', () => {
    expect(getContractUrl(ADDRESS)).toBe('#')
  })

  test('generates settlement contract URL with code anchor', () => {
    const url = getContractUrl(ADDRESS, 'settlement')
    expect(url).toContain('/address/')
    expect(url).toContain(ADDRESS)
    expect(url).toContain('#code')
  })
})

describe('getExplorerBaseUrl', () => {
  test('returns empty string for unconfigured L3', () => {
    expect(getExplorerBaseUrl('l3')).toBe('')
  })

  test('returns configured settlement explorer URL', () => {
    const url = getExplorerBaseUrl('settlement')
    expect(url).toBeTruthy()
    expect(url.startsWith('http')).toBe(true)
  })
})
