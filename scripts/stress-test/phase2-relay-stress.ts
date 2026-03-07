/**
 * Phase 2: Issuer Relay Stress
 *
 * Submits N requestCreateItp() on Settlement BridgeProxy simultaneously,
 * measures how long it takes issuers to process the backlog.
 */

import {
  PHASE2_LEVELS, SETTLEMENT_RPC, SETTLEMENT_BRIDGE_PROXY, DEPLOYER, ANVIL_ACCOUNTS,
} from './config';
import {
  log, logSection, logVerbose, timer, sleep,
  requestCreateItp, isPending, getNextCreationNonce,
  deployMockToken, resetAllNonces,
} from './helpers';
import { checkAllHealthy } from './monitor';

export interface Phase2Result {
  level: string;
  label: string;
  requestsSent: number;
  requestTimeMs: number;
  completionTimeMs: number;
  processingRate: number; // requests/sec
  allCompleted: boolean;
  healthStable: boolean;
  breakingPoint: string | null;
}

export async function runPhase2(): Promise<Phase2Result[]> {
  logSection('PHASE 2: ISSUER RELAY STRESS');

  // Deploy 3 test tokens for relay ITPs
  log('Deploying tokens for relay test...');
  const [t1, t2, t3] = await Promise.all([
    deployMockToken('RelayT1', 'RT1'),
    deployMockToken('RelayT2', 'RT2'),
    deployMockToken('RelayT3', 'RT3'),
  ]);

  const weights = [
    400000000000000000n,
    300000000000000000n,
    300000000000000000n,
  ];
  const assets = [t1, t2, t3];
  const prices = [10n ** 18n, 10n ** 18n, 10n ** 18n];

  const results: Phase2Result[] = [];

  for (const [key, level] of Object.entries(PHASE2_LEVELS)) {
    const result = await runLevel(key, level, assets, weights, prices);
    results.push(result);
  }

  return results;
}

async function runLevel(
  levelKey: string,
  level: { requests: number; label: string },
  assets: string[],
  weights: bigint[],
  prices: bigint[],
): Promise<Phase2Result> {
  logSection(`Phase 2 Level ${levelKey}: ${level.requests} requests — ${level.label}`);

  // Reset nonce cache between levels to avoid stale nonces
  resetAllNonces();

  const result: Phase2Result = {
    level: levelKey,
    label: level.label,
    requestsSent: 0,
    requestTimeMs: 0,
    completionTimeMs: 0,
    processingRate: 0,
    allCompleted: false,
    healthStable: true,
    breakingPoint: null,
  };

  // Record starting nonce so we know the range
  const startNonce = await getNextCreationNonce();
  log(`  Starting nonce: ${startNonce}`);

  // Blast all requests as fast as possible
  const tSend = timer('send');
  const submittedNonces: bigint[] = [];

  // Use multiple accounts to avoid nonce serialization
  const senders = ANVIL_ACCOUNTS.slice(0, Math.min(level.requests, 10));

  log(`  Sending ${level.requests} requestCreateItp calls...`);
  const sendPromises: Promise<void>[] = [];
  let sent = 0;

  for (let i = 0; i < level.requests; i++) {
    const sender = senders[i % senders.length];
    const name = `Relay${levelKey}${i}`;
    const symbol = `R${levelKey}${i}`;
    const expectedNonce = startNonce + BigInt(i);

    sendPromises.push(
      requestCreateItp(name, symbol, weights, assets, prices, sender)
        .then(() => {
          sent++;
          submittedNonces.push(expectedNonce);
          if (sent % 10 === 0) logVerbose(`  Sent ${sent}/${level.requests}`);
        })
        .catch(err => {
          if (!result.breakingPoint) {
            result.breakingPoint = `Send failed at #${i}: ${err.message}`;
          }
        })
    );

    // Slight stagger to avoid RPC overload (10 concurrent max)
    if (sendPromises.length >= 10) {
      await Promise.all(sendPromises.splice(0, 10));
    }
  }
  await Promise.all(sendPromises);

  result.requestsSent = sent;
  result.requestTimeMs = tSend.stop().ms;
  log(`  Sent ${sent} requests in ${result.requestTimeMs.toFixed(0)}ms`);

  if (sent === 0) {
    result.breakingPoint = result.breakingPoint ?? 'No requests sent';
    return result;
  }

  // Sort submitted nonces so we can check the highest one first
  submittedNonces.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const highestNonce = submittedNonces[submittedNonces.length - 1];

  // Wait for all to complete (isPending → false)
  const tComplete = timer('complete');
  const timeoutMs = level.requests * 3_000 + 30_000; // generous timeout
  log(`  Waiting for completion (timeout: ${(timeoutMs / 1000).toFixed(0)}s)...`);

  let completed = 0;
  const checkInterval = 2_000;
  const startCheck = Date.now();

  while (Date.now() - startCheck < timeoutMs) {
    try {
      // Check the highest actually-submitted nonce
      const stillPending = await isPending(highestNonce);
      if (!stillPending) {
        // Highest is done — all lower ones should be done too
        completed = sent;
        break;
      }
    } catch {
      // RPC error — check health
      const healthy = await checkAllHealthy();
      if (!healthy) result.healthStable = false;
    }

    // Check health periodically
    if ((Date.now() - startCheck) % 10_000 < checkInterval) {
      const healthy = await checkAllHealthy();
      if (!healthy) {
        result.healthStable = false;
        logVerbose('  Health check: UNHEALTHY');
      }
    }

    await sleep(checkInterval);
    logVerbose(`  Still waiting... (${((Date.now() - startCheck) / 1000).toFixed(0)}s elapsed)`);
  }

  // Final check — count how many actually completed from the submitted set
  if (completed === 0) {
    for (let i = submittedNonces.length - 1; i >= 0; i--) {
      try {
        const pending = await isPending(submittedNonces[i]);
        if (!pending) {
          completed = i + 1;
          break;
        }
      } catch { break; }
    }
  }

  result.completionTimeMs = tComplete.stop().ms;
  result.allCompleted = completed >= sent;

  if (result.completionTimeMs > 0 && completed > 0) {
    result.processingRate = (completed / result.completionTimeMs) * 1000;
  }

  log(`  Completed: ${completed}/${sent} in ${result.completionTimeMs.toFixed(0)}ms`);
  log(`  Processing rate: ${result.processingRate.toFixed(2)} req/s`);
  log(`  Health stable: ${result.healthStable}`);
  if (result.breakingPoint) {
    log(`  Breaking point: ${result.breakingPoint}`);
  }

  return result;
}
