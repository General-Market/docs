/**
 * API routes that test 23 doesn't cover.
 * Verifies each untested endpoint returns a valid response (not 500).
 */
import { test, expect } from '../fixtures/wallet'
import { FRONTEND_URL, DEPLOYER_ADDRESS } from '../env'

const BASE = FRONTEND_URL
const TEST_ADDR = DEPLOYER_ADDRESS
const ITP_ID = '0x' + '0'.repeat(63) + '1'

async function apiGet(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'application/json' },
  })
}

async function apiPost(path: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
}

test.describe('API Routes Coverage (untested endpoints)', () => {
  test('GET /api/vision/sources returns array or object', async () => {
    const res = await apiGet('/api/vision/sources')
    expect(res.status).toBeLessThan(500)
    if (res.ok) {
      const data = await res.json()
      expect(typeof data).toBe('object')
    }
  })

  test('GET /api/vision/rounds returns response', async () => {
    const res = await apiGet('/api/vision/rounds')
    expect(res.status).toBeLessThan(500)
  })

  test('GET /api/vision/bitmap with batchId', async () => {
    const res = await apiGet('/api/vision/bitmap?batchId=1&player=' + TEST_ADDR)
    expect(res.status).toBeLessThan(500)
  })

  test('GET /api/vision/player/{addr}/rounds', async () => {
    const res = await apiGet(`/api/vision/player/${TEST_ADDR}/rounds`)
    expect(res.status).toBeLessThan(500)
    if (res.ok) {
      const data = await res.json()
      expect(Array.isArray(data) || typeof data === 'object').toBe(true)
    }
  })

  test('GET /api/vision/player/{addr}/profile', async () => {
    const res = await apiGet(`/api/vision/player/${TEST_ADDR}/profile`)
    expect(res.status).toBeLessThan(500)
  })

  test('GET /api/vision/source/{id}/history', async () => {
    const res = await apiGet('/api/vision/source/coingecko/history')
    expect(res.status).toBeLessThan(500)
  })

  test('GET /api/config returns config object', async () => {
    const res = await apiGet('/api/config')
    expect(res.status).toBeLessThan(500)
    if (res.ok) {
      const data = await res.json()
      expect(typeof data).toBe('object')
    }
  })

  test('GET /api/itp-enrichment with itpId', async () => {
    const res = await apiGet(`/api/itp-enrichment?itpId=${ITP_ID}`)
    expect(res.status).toBeLessThan(500)
  })

  test('POST /api/rpc proxies JSON-RPC', async () => {
    const res = await apiPost('/api/rpc', {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_chainId',
      params: [],
    })
    expect(res.status).toBeLessThan(500)
    if (res.ok) {
      const data = await res.json()
      expect(data).toHaveProperty('jsonrpc')
      expect(data).toHaveProperty('result')
    }
  })

  test('GET /api/vision/user with address', async () => {
    const res = await apiGet(`/api/vision/user?address=${TEST_ADDR}`)
    expect(res.status).toBeLessThan(500)
  })
})
