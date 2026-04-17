/**
 * Playwright fixture: injects mock wallet and exports test constants.
 * Extends @playwright/test with a `walletPage` fixture that has the
 * mock EIP-1193 provider injected before any page JS runs.
 *
 * Transactions are signed with real private keys via exposed functions.
 *
 * Two fixtures:
 * - `test` (walletPage) — DEPLOYER_KEY, starts at /index (for ITP tests)
 * - `visionTest` (walletPage) — VISION_PLAYER_KEY, starts at / (for Vision tests)
 */
import { test as base, type Page } from '@playwright/test';
import { getInjectWalletScript } from '../helpers/inject-wallet';
import { installApiInterceptors } from '../helpers/api-interceptor';
import {
  L3_RPC, SETTLEMENT_RPC, BACKEND_URL as ENV_BACKEND_URL,
  FRONTEND_URL as ENV_FRONTEND_URL, CHAIN_ID as ENV_CHAIN_ID,
  SETTLEMENT_CHAIN_ID as ENV_SETTLEMENT_CHAIN_ID, DEPLOYER_KEY,
  CONTRACTS as ENV_CONTRACTS, DEPLOYER_ADDRESS,
  VISION_PLAYER_KEY, VISION_PLAYER_ADDRESS,
} from '../env';

// ── Constants ───────────────────────────────────────────────

/** Test user — deployer key (has admin access + ETH on L3) */
export const TEST_ADDRESS = DEPLOYER_ADDRESS;
export const TEST_PRIVATE_KEY = DEPLOYER_KEY;

/** L3 RPC */
export const L3_RPC_URL = L3_RPC;

/** Settlement RPC */
export const RPC_URL = SETTLEMENT_RPC;

/** Data-node backend */
export const BACKEND_URL = ENV_BACKEND_URL;

/** Frontend URL */
export const FRONTEND_URL = ENV_FRONTEND_URL;

/** Chain IDs */
export const CHAIN_ID = ENV_CHAIN_ID;
export const SETTLEMENT_CHAIN_ID = ENV_SETTLEMENT_CHAIN_ID;

/** Known ITP ID from deployment */
export const ITP_ID = '0x0000000000000000000000000000000000000000000000000000000000000001';

/** Contract addresses — from active-deployment.json via env.ts (single source of truth) */
export const CONTRACTS = ENV_CONTRACTS;

// ── Wallet Fixture Factory ──────────────────────────────────

function createWalletFixture(privateKey: `0x${string}`, address: string, startUrl: string) {
  return async ({ context, page }: { context: any; page: Page }, use: (page: Page) => Promise<void>) => {
    // Expose signing functions for real transaction signing
    const { createWalletClient, http, defineChain } = await import('viem');
    const { privateKeyToAccount } = await import('viem/accounts');

    const account = privateKeyToAccount(privateKey);
    const l3Chain = defineChain({
      id: CHAIN_ID,
      name: 'Index L3',
      nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 },
      rpcUrls: { default: { http: [L3_RPC_URL] } },
    });

    // Expose transaction signing to browser context
    await page.exposeFunction('__e2eSignAndSend', async (txJson: string) => {
      const tx = JSON.parse(txJson);
      const rpcUrl = tx.rpcUrl || L3_RPC_URL;
      const chainId = tx.chainId || CHAIN_ID;

      console.log(`[e2e-wallet] sendTx chainId=${chainId} rpc=${rpcUrl} to=${tx.to} data=${(tx.data || '').slice(0, 10)}...`);

      const chain = chainId === CHAIN_ID ? l3Chain : defineChain({
        id: chainId,
        name: `Chain ${chainId}`,
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [rpcUrl] } },
      });

      const client = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl, { fetchOptions: { headers: { Accept: 'application/json' } } }),
      });

      try {
        const hash = await client.sendTransaction({
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}` | undefined,
          value: tx.value ? BigInt(tx.value) : undefined,
          gas: tx.gas ? BigInt(tx.gas) : undefined,
        });
        console.log(`[e2e-wallet] tx sent: ${hash}`);
        return hash;
      } catch (err) {
        console.error(`[e2e-wallet] tx FAILED: ${(err as Error).message}`);
        throw err;
      }
    });

    // Expose personal_sign
    await page.exposeFunction('__e2ePersonalSign', async (message: string) => {
      const { signMessage } = await import('viem/accounts');
      return signMessage({ message: { raw: message as `0x${string}` }, privateKey });
    });

    // Inject mock wallet into every page in the context (before any JS runs)
    const script = getInjectWalletScript(L3_RPC_URL, CHAIN_ID, address, RPC_URL, SETTLEMENT_CHAIN_ID);
    await context.addInitScript({ content: script });

    // Seed wagmi localStorage so it auto-reconnects on page load.
    const wagmiState = JSON.stringify({
      state: {
        connections: {
          __type: 'Map',
          value: [
            [
              'injected',
              {
                accounts: [address.toLowerCase() as `0x${string}`],
                chainId: CHAIN_ID,
                connector: { id: 'injected', name: 'Injected', type: 'injected', uid: 'injected' },
              },
            ],
          ],
        },
        chainId: CHAIN_ID,
        current: 'injected',
      },
      version: 3,
    });
    await context.addInitScript({ content: `localStorage.setItem('wagmi.store', ${JSON.stringify(wagmiState)});` });

    // Intercept backend API calls that may 404 on stale binary
    await installApiInterceptors(page);

    // Navigate to trigger the init script.
    // Use 'domcontentloaded' instead of 'load' — Next.js dev server compiles JS on demand,
    // so 'load' can take 90s+ on cold cache. We verify React hydration separately below.
    // Retry up to 3 times with 30s each — the dev server can hang intermittently under load.
    let navigated = false;
    for (let attempt = 1; attempt <= 3 && !navigated; attempt++) {
      try {
        await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        navigated = true;
      } catch {
        if (attempt < 3) {
          // Brief backoff before retry — server may recover between attempts
          await new Promise(r => setTimeout(r, 2_000));
        }
      }
    }
    if (!navigated) {
      // Final attempt with full timeout
      await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    }

    // Wait for React hydration
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('button');
        if (!btn) return false;
        return Object.keys(btn).some(k => k.startsWith('__reactFiber') || k.startsWith('__reactProps'));
      },
      { timeout: 30_000 }
    ).catch(() => {});
    // Wait for wagmi connector to initialize — address button appears when wallet connects
    await page.waitForFunction(
      () => !!document.querySelector('button[class*="connect"], header button'),
      { timeout: 10_000 }
    ).catch(() => {});

    await use(page);
  };
}

// ── Deployer wallet (ITP tests) ─────────────────────────────
export const test = base.extend<{ walletPage: Page }>({
  walletPage: createWalletFixture(DEPLOYER_KEY, DEPLOYER_ADDRESS, `${FRONTEND_URL}/index`),
});

// ── Vision player wallet (Vision tests) ─────────────────────
export const visionTest = base.extend<{ walletPage: Page }>({
  walletPage: createWalletFixture(VISION_PLAYER_KEY, VISION_PLAYER_ADDRESS, `${FRONTEND_URL}/`),
});

export { expect } from '@playwright/test';
