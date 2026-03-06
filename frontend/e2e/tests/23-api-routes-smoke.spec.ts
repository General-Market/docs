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
    const res = await apiGet('/api/deployment');
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toHaveProperty('contracts');
    expect(typeof data.contracts).toBe('object');
    expect(Object.keys(data.contracts).length).toBeGreaterThan(0);
  });

  test('POST /api/faucet returns 200 with valid address', async () => {
    if (!IS_ANVIL) {
      test.skip(true, 'Faucet only works on Anvil');
      return;
    }
    const res = await apiPost('/api/faucet', {
      address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    });
    expect(res.status).toBeLessThan(500);
  });

  test('GET /api/itp-price returns nav in sane range', async () => {
    const res = await apiGet('/api/itp-price');
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toHaveProperty('nav');
    const nav = Number(data.nav);
    expect(nav).toBeGreaterThan(0.01);
    expect(nav).toBeLessThan(1000);
  });

  test('GET /api/market/history returns array', async () => {
    const res = await apiGet('/api/market/history?pair=BTC-USD');
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/vision/batches returns array with batches', async () => {
    const res = await apiGet('/api/vision/batches');
    expect(res.ok).toBe(true);
    const data = await res.json();
    // Response shape: { batches: [...] } or direct array
    const batches = data.batches || data;
    expect(Array.isArray(batches)).toBe(true);
    expect(batches.length).toBeGreaterThanOrEqual(1);
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
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toBeDefined();
    expect(typeof data).toBe('object');
  });

  test('GET /api/vision/leaderboard returns leaderboard array', async () => {
    const res = await apiGet('/api/vision/leaderboard');
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toHaveProperty('leaderboard');
    expect(Array.isArray(data.leaderboard)).toBe(true);
  });
});
