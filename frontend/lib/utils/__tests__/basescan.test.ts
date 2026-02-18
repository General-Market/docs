import { describe, test, expect } from 'bun:test'
import { getTxUrl, getAddressUrl, getContractUrl } from '../basescan'

describe('getTxUrl', () => {
  test('generates correct transaction URL', () => {
    const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    const url = getTxUrl(txHash)
    expect(url).toBe(`https://basescan.org/tx/${txHash}`)
  })
})

describe('getAddressUrl', () => {
  test('generates correct address URL', () => {
    const address = '0x1234567890123456789012345678901234567890'
    const url = getAddressUrl(address)
    expect(url).toBe(`https://basescan.org/address/${address}`)
  })
})

describe('getContractUrl', () => {
  test('generates correct contract URL with code anchor', () => {
    const address = '0x1234567890123456789012345678901234567890'
    const url = getContractUrl(address)
    expect(url).toBe(`https://basescan.org/address/${address}#code`)
  })
})
