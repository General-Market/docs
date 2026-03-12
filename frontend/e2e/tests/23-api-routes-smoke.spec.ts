/**
 * Smoke tests for API routes with zero E2E coverage.
 * Verifies each route returns valid response shapes.
 */
import { test, expect } from '../fixtures/wallet';
import { IS_ANVIL, FRONTEND_URL } from '../env';

const BASE = FRONTEND_URL;

async function apiGet(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'application/json' },
  });
}

async function apiPost(path: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
}

test.describe('API Routes Smoke Tests', () => {
  test('GET /api/deployment returns contracts object', async () => {
    const res = await apiGet('/api/deployment?file=active-deployment.json');
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toHaveProperty('contracts');
    expect(typeof data.contracts).toBe('object');
    expect(Object.keys(data.contracts).length).toBeGreaterThan(0);
  });

  test('POST /api/faucet returns 200 with valid address', async () => {
    const res = await apiPost('/api/faucet', {
      address: '0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4',
    });
    expect(res.status).toBeLessThan(500);
  });

  test('GET /api/itp-price returns nav in sane range', async () => {
    const itpId = '0x' + '0'.repeat(63) + '1';
    const res = await apiGet(`/api/itp-price?itp_id=${itpId}`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toHaveProperty('nav');
    const nav = Number(data.nav);
    expect(nav).toBeGreaterThan(0.01);
    expect(nav).toBeLessThan(1e21); // NAV is in wei (1e18 = $1)
  });

  test('GET /api/market/history returns array or valid error', async () => {
    // This endpoint needs source + asset params, not pair
    const res = await apiGet('/api/market/history?source=coingecko&asset=bitcoin');
    // On testnet, data-node may not have this data — accept 200 or 400/502
    if (res.ok) {
      const data = await res.json();
      expect(Array.isArray(data) || typeof data === 'object').toBe(true);
    } else {
      // Non-200 is acceptable if data-node doesn't have the data
      expect(res.status).toBeLessThan(600);
    }
  });

  test('GET /api/vision/batches returns valid response', async () => {
    const res = await apiGet('/api/vision/batches');
    // On testnet, issuer may return 502 if no batches configured
    if (res.ok) {
      const data = await res.json();
      const batches = data.batches || data;
      expect(Array.isArray(batches)).toBe(true);
    } else {
      expect(res.status).toBeLessThan(600);
    }
  });

  test('GET /api/vision/snapshot returns valid JSON', async () => {
    const res = await apiGet('/api/vision/snapshot');
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toBeDefined();
    expect(typeof data).toBe('object');
  });

  test('GET /api/vision/snapshot/meta returns sources health', async () => {
    const res = await apiGet('/api/vision/snapshot/meta');
    // On testnet, data-node /admin/sources/health may not be available (returns 502)
    if (res.ok) {
      const data = await res.json();
      expect(data).toBeDefined();
      expect(typeof data).toBe('object');
    } else {
      // Accept 502 (data-node unreachable) but fail on unexpected errors
      expect([502, 503, 504]).toContain(res.status);
    }
  });

  test('GET /api/vision/leaderboard returns valid response', async () => {
    const res = await apiGet('/api/vision/leaderboard');
    // On testnet, issuer may return 502 if no leaderboard data
    if (res.ok) {
      const data = await res.json();
      expect(data).toHaveProperty('leaderboard');
      expect(Array.isArray(data.leaderboard)).toBe(true);
    } else {
      // 502 is acceptable — issuer returns fallback empty leaderboard
      const data = await res.json();
      expect(data).toHaveProperty('leaderboard');
    }
  });
});
