import { test, expect } from '@playwright/test';
import { AP_URL } from '../env';

test.describe('AP Endpoints', () => {
  test('GET /health returns valid status', async () => {
    const res = await fetch(`${AP_URL}/health`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('queue_depth');
  });

  test('GET /metrics returns Prometheus format', async () => {
    const res = await fetch(`${AP_URL}/metrics`, {
      signal: AbortSignal.timeout(10_000),
    });
    expect(res.ok).toBe(true);
    const text = await res.text();
    expect(text).toContain('queue_depth');
  });
});
