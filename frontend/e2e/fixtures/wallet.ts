/**
 * Playwright fixture: injects mock wallet and exports test constants.
 * Extends @playwright/test with a `walletPage` fixture that has the
 * mock EIP-1193 provider injected before any page JS runs.
 *
 * Supports two modes:
 * - Local (Anvil): eth_sendTransaction auto-accepted, no signing needed
 * - Testnet: transactions signed with real private key via exposed function
 *
 * Set E2E_TESTNET=1 to enable testnet mode.
 */
import { test as base, type Page } from '@playwright/test';
import { getInjectWalletScript } from '../helpers/inject-wallet';
import { installApiInterceptors } from '../helpers/api-interceptor';
import { readFileSync } from 'fs';
import { join } from 'path';

// ── Environment-driven config ───────────────────────────────

const IS_TESTNET = process.env.E2E_TESTNET === '1';

/** Load contract addresses from deployment JSON */
function loadDeployment() {
  try {
    const path = join(__dirname, '..', '..', '..', 'deployments', 'active-deployment.json');
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

const _deployment = loadDeployment();
const _contracts = _deployment?.contracts ?? {};

// ── Constants ───────────────────────────────────────────────

/** Test user — deployer key (has admin access + ETH on L3) */
export const TEST_ADDRESS = '0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4';
export const TEST_PRIVATE_KEY = process.env.E2E_PRIVATE_KEY || '0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537';

/** L3 RPC */
export const L3_RPC_URL = process.env.E2E_L3_RPC_URL || (IS_TESTNET ? 'http://142.132.164.24/' : 'http://localhost:8545');

/** Arbitrum RPC (same as L3 on testnet) */
export const RPC_URL = process.env.E2E_ARB_RPC_URL || (IS_TESTNET ? L3_RPC_URL : 'http://localhost:8546');

/** Data-node backend */
export const BACKEND_URL = process.env.E2E_BACKEND_URL || (IS_TESTNET ? 'http://116.203.156.98/data-node' : 'http://localhost:8200');

/** Frontend URL */
export const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:3000';

/** Chain IDs */
export const CHAIN_ID = Number(process.env.E2E_CHAIN_ID || _deployment?.chainId || 111222333);
export const ARB_CHAIN_ID = Number(process.env.E2E_ARB_CHAIN_ID || (IS_TESTNET ? CHAIN_ID : 421611337));

/** Known ITP ID from deployment */
export const ITP_ID = '0x0000000000000000000000000000000000000000000000000000000000000001';

/** Contract addresses — from deployment.json with Anvil fallbacks */
export const CONTRACTS = {
  Index: _contracts.Index ?? '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
  ArbBridgeCustody: _contracts.ArbBridgeCustody ?? '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
  ARB_USDC: _contracts.ARB_USDC ?? '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  BridgedITP: _contracts.BridgedITP ?? '0x8D308d3D699A85472d874DBDBbffd16bc9fBD856',
  BridgeProxy: _contracts.BridgeProxy ?? '0x59b670e9fA9D0A427751Af201D676719a970857b',
  BridgedItpFactory: _contracts.BridgedItpFactory ?? '0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1',
  Morpho: _contracts.Morpho ?? '0x23228469b3439d81DC64e3523068976201bA08C3',
  L3_WUSDC: _contracts.L3_WUSDC ?? _contracts.USDC ?? '',
  Vision: _contracts.Vision ?? '',
} as const;

// ── Fixture ─────────────────────────────────────────────────

export const test = base.extend<{ walletPage: Page }>({
  walletPage: async ({ context, page }, use) => {
    // On testnet: expose signing function for real transaction signing
    if (IS_TESTNET) {
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
          transport: http(rpcUrl),
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
    const script = getInjectWalletScript(L3_RPC_URL, CHAIN_ID, TEST_ADDRESS, RPC_URL, ARB_CHAIN_ID);
    await context.addInitScript({ content: script });

    // Intercept backend API calls that may 404 on stale binary
    await installApiInterceptors(page);

    // Navigate to trigger the init script
    const startUrl = `${FRONTEND_URL}/index`;
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch(() => {
      return page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    });

    // Wait for React hydration
    await page.waitForFunction(
      () => !!(window as any).__NEXT_DATA__?.props,
      { timeout: 15_000 }
    ).catch(() => {});
    // Extra buffer for wagmi connector initialization
    await page.waitForTimeout(2_000);

    await use(page);
  },
});

export { expect } from '@playwright/test';
