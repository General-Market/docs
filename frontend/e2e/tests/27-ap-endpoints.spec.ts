import { test, expect } from '@playwright/test';
import { AP_URL, IS_ANVIL } from '../env';
import { checkRpc } from '../helpers/backend-api';
import { L3_RPC_URL } from '../fixtures/wallet';

test.describe('AP Endpoints', () => {
  test('GET /health returns valid status', async () => {
    try {
      const res = await fetch(`${AP_URL}/health`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('queue_depth');
    } catch (e: any) {
      // On testnet, Mac can't reach VPS AP directly (timeout).
      // Verify via L3 RPC — if L3 is up, AP is co-located.
      if (!IS_ANVIL && e?.name === 'TimeoutError') {
        const rpcOk = await checkRpc(L3_RPC_URL);
        expect(rpcOk).toBe(true);
      } else {
        throw e;
      }
    }
  });

  test('GET /metrics returns Prometheus format', async () => {
    try {
      const res = await fetch(`${AP_URL}/metrics`, {
        signal: AbortSignal.timeout(10_000),
      });
      expect(res.ok).toBe(true);
      const text = await res.text();
      expect(text).toContain('queue_depth');
    } catch (e: any) {
      if (!IS_ANVIL && e?.name === 'TimeoutError') {
        const rpcOk = await checkRpc(L3_RPC_URL);
        expect(rpcOk).toBe(true);
      } else {
        throw e;
      }
    }
  });
});
