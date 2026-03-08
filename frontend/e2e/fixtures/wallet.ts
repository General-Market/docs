/**
 * Playwright fixture: injects mock wallet and exports test constants.
 * Extends @playwright/test with a `walletPage` fixture that has the
 * mock EIP-1193 provider injected before any page JS runs.
 *
 * Supports two modes:
 * - Local (Anvil): eth_sendTransaction auto-accepted, no signing needed
 * - Testnet: transactions signed with real private key via exposed function
 */
import { test as base, type Page } from '@playwright/test';
import { getInjectWalletScript } from '../helpers/inject-wallet';
import { installApiInterceptors } from '../helpers/api-interceptor';
import {
  IS_ANVIL, L3_RPC, SETTLEMENT_RPC, BACKEND_URL as ENV_BACKEND_URL,
  FRONTEND_URL as ENV_FRONTEND_URL, CHAIN_ID as ENV_CHAIN_ID,
  SETTLEMENT_CHAIN_ID as ENV_SETTLEMENT_CHAIN_ID, DEPLOYER_KEY,
  CONTRACTS as ENV_CONTRACTS, DEPLOYER_ADDRESS,
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

/** Contract addresses — from deployment.json with Anvil fallbacks */
export const CONTRACTS = {
  Index: ENV_CONTRACTS.Index ?? '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
  SettlementBridgeCustody: ENV_CONTRACTS.SettlementBridgeCustody ?? '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
  SETTLEMENT_USDC: ENV_CONTRACTS.SETTLEMENT_USDC ?? '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  BridgedITP: ENV_CONTRACTS.BridgedITP ?? '0x8D308d3D699A85472d874DBDBbffd16bc9fBD856',
  BridgeProxy: ENV_CONTRACTS.BridgeProxy ?? '0x59b670e9fA9D0A427751Af201D676719a970857b',
  BridgedItpFactory: ENV_CONTRACTS.BridgedItpFactory ?? '0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1',
  Morpho: ENV_CONTRACTS.Morpho ?? '0x23228469b3439d81DC64e3523068976201bA08C3',
  L3_WUSDC: ENV_CONTRACTS.L3_WUSDC ?? ENV_CONTRACTS.USDC ?? '',
  Vision: ENV_CONTRACTS.Vision ?? '',
} as const;

// ── Fixture ─────────────────────────────────────────────────

export const test = base.extend<{ walletPage: Page }>({
  walletPage: async ({ context, page }, use) => {
    // On testnet: expose signing function for real transaction signing
    if (!IS_ANVIL) {
      const { createWalletClient, http, defineChain } = await import('viem');
      const { privateKeyToAccount } = await import('viem/accounts');

      const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);
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

        const hash = await client.sendTransaction({
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}` | undefined,
          value: tx.value ? BigInt(tx.value) : undefined,
          gas: tx.gas ? BigInt(tx.gas) : undefined,
        });
        return hash;
      });

      // Expose personal_sign
      await page.exposeFunction('__e2ePersonalSign', async (message: string, _address: string) => {
        const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);
        const { signMessage } = await import('viem/accounts');
        return signMessage({ message: { raw: message as `0x${string}` }, privateKey: TEST_PRIVATE_KEY as `0x${string}` });
      });
    }

    // Inject mock wallet into every page in the context (before any JS runs)
    const script = getInjectWalletScript(L3_RPC_URL, CHAIN_ID, TEST_ADDRESS, RPC_URL, SETTLEMENT_CHAIN_ID);
    await context.addInitScript({ content: script });

    // Seed wagmi localStorage so it auto-reconnects on page load.
    // Without this, wagmi v2 in App Router won't auto-connect on a fresh browser context.
    const wagmiState = JSON.stringify({
      state: {
        connections: {
          __type: 'Map',
          value: [
            [
              'injected',
              {
                accounts: [TEST_ADDRESS.toLowerCase() as `0x${string}`],
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

    // Navigate to trigger the init script
    const startUrl = `${FRONTEND_URL}/index`;
    await page.goto(startUrl, { waitUntil: 'load', timeout: 90_000 }).catch(() => {
      return page.goto(startUrl, { waitUntil: 'load', timeout: 90_000 })
    });

    // Wait for React hydration — App Router doesn't use __NEXT_DATA__.props.
    // Instead, check for React fiber keys on DOM elements (proves React has hydrated).
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('button');
        if (!btn) return false;
        return Object.keys(btn).some(k => k.startsWith('__reactFiber') || k.startsWith('__reactProps'));
      },
      { timeout: 30_000 }
    ).catch(() => {});
    // Extra buffer for wagmi connector initialization
    await page.waitForTimeout(2_000);

    await use(page);
  },
});

export { expect } from '@playwright/test';
