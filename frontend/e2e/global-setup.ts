/**
 * E2E global setup — runs once before any test workers start.
 *
 * 1. Validates all deployment addresses (catches stale deployments early)
 * 2. Enforces preconditions — Vision batches exist, deployer funded, services reachable
 * 3. Warms up Next.js dev server (compiles pages on first request)
 */
import { FRONTEND_URL, L3_RPC, BACKEND_URL, VISION_API, CONTRACTS, DEPLOYER_ADDRESS } from './env'
import { validateDeployment, printDeploymentReport, type DeploymentHealth } from './helpers/address-validator'

// ── Precondition checks ──────────────────────────────────────

/**
 * Verify that the deployment is actually ready for testing.
 * This is NOT a seeder — it creates nothing. It reads on-chain and API state
 * and fails fast with actionable error messages when something is missing.
 *
 * Runs in < 5 seconds — just HTTP/RPC calls, no on-chain writes.
 */
async function ensurePreconditions(health: DeploymentHealth): Promise<void> {
  const preconditions: NonNullable<DeploymentHealth['preconditions']> = {
    hasVisionBatches: false,
    onChainBatchCount: 0,
    deployerHasUsdc: false,
    deployerUsdcBalance: '0',
    dataNodeReachable: false,
    dataNodeStatus: undefined,
    visionApiReachable: false,
    visionApiBatchCount: 0,
  }

  const failures: string[] = []
  const TIMEOUT = 5_000

  // ── 1. Check Vision batches on-chain (nextBatchId > 0) ──
  if (health.l3Reachable && CONTRACTS.Vision) {
    try {
      // nextBatchId() → returns the next batch ID (so > 0 means at least 1 batch exists)
      const nextBatchIdSelector = '0x8462a7f8' // keccak256("nextBatchId()")[:4]
      const res = await fetch(L3_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'eth_call',
          params: [{ to: CONTRACTS.Vision, data: nextBatchIdSelector }, 'latest'],
        }),
        signal: AbortSignal.timeout(TIMEOUT),
      })
      const data = await res.json() as { result?: string; error?: { message: string } }
      if (data.error) {
        failures.push(`Vision.nextBatchId() reverted: ${data.error.message}`)
      } else {
        const count = Number(BigInt(data.result || '0x0'))
        preconditions.onChainBatchCount = count
        preconditions.hasVisionBatches = count > 0
        if (count === 0) {
          failures.push('No Vision batches found on-chain — run DeployAllVisionBatches.s.sol first')
        }
      }
    } catch (err) {
      failures.push(`Vision.nextBatchId() call failed: ${(err as Error).message}`)
    }
  } else if (!CONTRACTS.Vision) {
    failures.push('Vision contract address missing from deployment.json')
  }

  // ── 2. Check deployer USDC balance > 0 ──
  if (health.l3Reachable && CONTRACTS.L3_WUSDC && DEPLOYER_ADDRESS) {
    try {
      // balanceOf(address) selector + deployer address padded to 32 bytes
      const addrPadded = DEPLOYER_ADDRESS.replace('0x', '').toLowerCase().padStart(64, '0')
      const calldata = `0x70a08231${addrPadded}` // balanceOf(address)
      const res = await fetch(L3_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'eth_call',
          params: [{ to: CONTRACTS.L3_WUSDC, data: calldata }, 'latest'],
        }),
        signal: AbortSignal.timeout(TIMEOUT),
      })
      const data = await res.json() as { result?: string; error?: { message: string } }
      if (data.error) {
        failures.push(`L3_WUSDC.balanceOf(deployer) reverted: ${data.error.message}`)
      } else {
        const balance = BigInt(data.result || '0x0')
        preconditions.deployerUsdcBalance = balance.toString()
        preconditions.deployerHasUsdc = balance > 0n
        if (balance === 0n) {
          failures.push(`Deployer ${DEPLOYER_ADDRESS} has 0 L3 USDC — tests cannot fund players`)
        }
      }
    } catch (err) {
      failures.push(`L3_WUSDC.balanceOf() call failed: ${(err as Error).message}`)
    }
  }

  // ── 3. Check data-node reachability ──
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(TIMEOUT),
    })
    preconditions.dataNodeReachable = res.ok
    preconditions.dataNodeStatus = `${res.status} ${res.statusText}`
    if (!res.ok) {
      failures.push(`Data-node /health returned ${res.status} — is the data-node running?`)
    }
  } catch (err) {
    preconditions.dataNodeStatus = (err as Error).message
    failures.push(`Data-node unreachable at ${BACKEND_URL}/health — start the data-node first`)
  }

  // ── 4. Check Vision API reachability (/vision/batches) ──
  try {
    const res = await fetch(`${VISION_API}/vision/batches`, {
      signal: AbortSignal.timeout(TIMEOUT),
    })
    if (res.ok) {
      preconditions.visionApiReachable = true
      const body = await res.json() as { batches?: unknown[] }
      const batches = body.batches ?? (Array.isArray(body) ? body : [])
      preconditions.visionApiBatchCount = (batches as unknown[]).length
    } else {
      failures.push(`Vision API /vision/batches returned ${res.status} — is the oracle running?`)
    }
  } catch (err) {
    failures.push(`Vision API unreachable at ${VISION_API}/vision/batches — start an oracle/issuer first`)
  }

  // ── Report ──
  health.preconditions = preconditions

  console.log('\n[global-setup] ══════ Precondition Report ══════')
  console.log(`  Vision batches (on-chain): ${preconditions.onChainBatchCount} ${preconditions.hasVisionBatches ? 'OK' : 'MISSING'}`)
  console.log(`  Deployer USDC balance:     ${preconditions.deployerHasUsdc ? 'funded' : 'EMPTY'} (${preconditions.deployerUsdcBalance})`)
  console.log(`  Data-node:                 ${preconditions.dataNodeReachable ? 'OK' : 'UNREACHABLE'} (${preconditions.dataNodeStatus ?? 'no response'})`)
  console.log(`  Vision API:                ${preconditions.visionApiReachable ? 'OK' : 'UNREACHABLE'} (${preconditions.visionApiBatchCount} batches)`)

  if (failures.length > 0) {
    console.error(`\n  PRECONDITION FAILURES (${failures.length}):`)
    for (const f of failures) {
      console.error(`    PRECONDITION FAILED: ${f}`)
    }
    console.error('[global-setup] ══════════════════════════════════\n')
    throw new Error(
      `E2E preconditions not met (${failures.length} failures). Fix the deployment before running tests.\n` +
      failures.map(f => `  - ${f}`).join('\n')
    )
  }
  console.log('\n  All preconditions satisfied')
  console.log('[global-setup] ══════════════════════════════════\n')
}

// ── Main setup ──────────────────────────────────────────────

async function globalSetup() {
  // Step 0: Validate all deployment addresses
  const health = await validateDeployment()
  printDeploymentReport(health)

  // Fail fast if core contracts are missing (don't waste 15 min on doomed run)
  const missingCore = health.coreContracts.filter(c => !c.hasCode)
  if (missingCore.length > 0 && health.l3Reachable) {
    console.error(`[global-setup] FATAL: ${missingCore.length} core contracts have no code. Redeploy before running E2E.`)
    console.error(`  Missing: ${missingCore.map(c => c.name).join(', ')}`)
    process.exit(1)
  }

  // Step 1: Enforce preconditions — batches exist, deployer funded, services up
  await ensurePreconditions(health)

  // Write health (now including preconditions) to a temp file so test workers can read it
  const { writeFileSync } = await import('fs')
  const { join } = await import('path')
  writeFileSync(
    join(__dirname, '.deployment-health.json'),
    JSON.stringify(health, null, 2),
  )

  // Step 2: Warm up Next.js dev server
  const baseURL = FRONTEND_URL;
  const pages = ['/', '/index'];

  for (const path of pages) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${baseURL}${path}`, { signal: AbortSignal.timeout(30_000) });
        if (res.ok) {
          console.log(`[global-setup] Warmed ${path} (${res.status})`);
          break;
        }
      } catch {
        // Server not ready or request timed out — retry
      }
      await new Promise(r => setTimeout(r, 2_000));
    }
  }

}

export default globalSetup;
