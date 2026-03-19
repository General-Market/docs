/**
 * E2E global setup — runs once before any test workers start.
 *
 * 1. Validates all deployment addresses (catches stale deployments early)
 * 2. Warms up Next.js dev server (compiles pages on first request)
 */
import { FRONTEND_URL } from './env'
import { validateDeployment, printDeploymentReport } from './helpers/address-validator'

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

  // Write health to a temp file so test workers can read it (faster than re-validating)
  const { writeFileSync } = await import('fs')
  const { join } = await import('path')
  writeFileSync(
    join(__dirname, '.deployment-health.json'),
    JSON.stringify(health, null, 2),
  )

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
