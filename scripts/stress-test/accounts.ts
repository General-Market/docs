/**
 * 100-account infrastructure for Phase 6 chaos testing.
 * Derives accounts from Anvil's eth_accounts RPC, impersonates, and funds them.
 */

import { L3_RPC, L3_INDEX, DEPLOYER } from './config';
import {
  rpcCall, l3Rpc, sendTx, fundAccountUsdc,
  log, logVerbose, sleep,
} from './helpers';

/** Get all 100 accounts from Anvil via eth_accounts RPC. */
export async function getChaosAccounts(): Promise<string[]> {
  const accounts = await l3Rpc('eth_accounts', []) as string[];
  if (accounts.length < 100) {
    throw new Error(
      `Expected 100 Anvil accounts, got ${accounts.length}. ` +
      `Ensure start.sh uses --accounts 100.`
    );
  }
  return accounts.slice(0, 100);
}

/** Impersonate all accounts on Anvil (batched in groups of 20). */
export async function impersonateAll(accounts: string[]): Promise<void> {
  const batchSize = 20;
  for (let i = 0; i < accounts.length; i += batchSize) {
    const batch = accounts.slice(i, i + batchSize);
    await Promise.all(
      batch.map(addr => l3Rpc('anvil_impersonateAccount', [addr]).catch(() => {}))
    );
    logVerbose(`Impersonated accounts ${i}-${Math.min(i + batchSize, accounts.length) - 1}`);
  }
}

/**
 * Fund all accounts with L3 USDC and approve Index contract.
 * Batched in groups of 10 to avoid nonce contention on DEPLOYER.
 */
export async function fundAllAccounts(
  accounts: string[],
  usdcAmount: bigint,
): Promise<{ funded: number; failed: number }> {
  let funded = 0;
  let failed = 0;
  const batchSize = 10;

  for (let i = 0; i < accounts.length; i += batchSize) {
    const batch = accounts.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(addr => fundAccountUsdc(addr, usdcAmount))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') funded++;
      else failed++;
    }
    if (i % 50 === 0 && i > 0) {
      logVerbose(`Funded ${funded} accounts so far...`);
    }
  }

  return { funded, failed };
}

/**
 * Full setup: get accounts, impersonate, fund.
 * Returns the list of chaos-ready accounts (excluding deployer at index 0).
 */
export async function setupChaosAccounts(
  usdcAmount: bigint = 1_000_000n * 10n ** 18n,
): Promise<string[]> {
  log('Getting 100 Anvil accounts...');
  const allAccounts = await getChaosAccounts();
  log(`  Got ${allAccounts.length} accounts`);

  // Use accounts 10-99 for chaos (0-9 reserved for existing tests)
  const chaosAccounts = allAccounts.slice(10);

  log('Impersonating chaos accounts...');
  await impersonateAll(chaosAccounts);

  log(`Funding ${chaosAccounts.length} accounts with ${(usdcAmount / (10n ** 18n)).toString()} USDC each...`);
  const { funded, failed } = await fundAllAccounts(chaosAccounts, usdcAmount);
  log(`  Funded: ${funded}, Failed: ${failed}`);

  return chaosAccounts;
}
