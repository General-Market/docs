/**
 * Playwright fixture: injects mock wallet and exports test constants.
 * Extends @playwright/test with a `walletPage` fixture that has the
 * mock EIP-1193 provider injected before any page JS runs.
 */
import { test as base, type Page } from '@playwright/test';
import { getInjectWalletScript } from '../helpers/inject-wallet';
import { installApiInterceptors } from '../helpers/api-interceptor';

// ── Constants ───────────────────────────────────────────────

/** Test user — impersonated on both Anvils by start.sh */
export const TEST_ADDRESS = '0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4';

/** Arbitrum Anvil RPC (frontend's NEXT_PUBLIC_RPC_URL) */
export const RPC_URL = 'http://localhost:8546';

/** L3 Anvil RPC */
export const L3_RPC_URL = 'http://localhost:8545';

/** Data-node backend */
export const BACKEND_URL = 'http://localhost:8200';

/** Chain ID the frontend expects (NEXT_PUBLIC_CHAIN_ID) — unique dev ID to avoid MetaMask conflict with real Arbitrum */
export const CHAIN_ID = 421611337;

/** Known ITP ID from deployment */
export const ITP_ID = '0x0000000000000000000000000000000000000000000000000000000000000001';

/** Contract addresses from deployment.json */
export const CONTRACTS = {
  Index: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
  ArbBridgeCustody: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
  ARB_USDC: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  BridgedITP: '0x8D308d3D699A85472d874DBDBbffd16bc9fBD856',
  BridgeProxy: '0x59b670e9fA9D0A427751Af201D676719a970857b',
  BridgedItpFactory: '0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1',
  Morpho: '0x23228469b3439d81DC64e3523068976201bA08C3',
} as const;

// ── Fixture ─────────────────────────────────────────────────

export const test = base.extend<{ walletPage: Page }>({
  walletPage: async ({ context, page }, use) => {
    // Inject mock wallet into every page in the context (before any JS runs)
    const script = getInjectWalletScript(RPC_URL, CHAIN_ID, TEST_ADDRESS);
    await context.addInitScript({ content: script });

    // Intercept backend API calls that may 404 on stale binary
    await installApiInterceptors(page);

    // Navigate to trigger the init script on the actual page
    await page.goto('/');

    await use(page);
  },
});

export { expect } from '@playwright/test';
