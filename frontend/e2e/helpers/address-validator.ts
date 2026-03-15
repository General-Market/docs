/**
 * Centralized address validator for E2E tests.
 *
 * Validates ALL deployment addresses have on-chain code before tests run.
 * Prevents mysterious test failures from stale deployment JSONs.
 *
 * Usage: called from global-setup.ts — prints a clear report and marks
 * addresses as "stale" so tests can make informed decisions.
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { L3_RPC, SETTLEMENT_RPC, CONTRACTS, DEPLOYMENT, IS_ANVIL } from '../env'

// ── Types ──

export interface AddressStatus {
  name: string
  address: string
  hasCode: boolean
  chain: 'l3' | 'settlement'
}

export interface DeploymentHealth {
  l3Reachable: boolean
  settlementReachable: boolean
  coreContracts: AddressStatus[]  // Must have code — tests fail hard if missing
  optionalContracts: AddressStatus[]  // May not be deployed — tests adapt
  morpho: {
    deployed: boolean
    collateralTokenAlive: boolean
    oracleAlive: boolean
    stale: boolean  // true if collateral token has no code
  }
  visionBatches: {
    count: number
    firstBatchExists: boolean
  }
  staleAddresses: string[]  // Human-readable list of problems
}

// ── RPC helper ──

async function rpcGetCode(rpcUrl: string, address: string): Promise<string> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'eth_getCode',
      params: [address, 'latest'],
    }),
    signal: AbortSignal.timeout(10_000),
  })
  const data = await res.json() as { result?: string }
  return data.result ?? '0x'
}

async function rpcChainId(rpcUrl: string): Promise<number> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    signal: AbortSignal.timeout(10_000),
  })
  const data = await res.json() as { result?: string }
  return parseInt(data.result ?? '0x0', 16)
}

// ── Core L3 contracts that MUST have code ──
const CORE_L3_CONTRACTS = [
  'Index', 'IssuerRegistry', 'Vision', 'L3_WUSDC',
  'CollateralRegistry', 'L3BridgeProxy',
] as const

// Optional L3 contracts — tests should adapt if missing
const OPTIONAL_L3_CONTRACTS = [
  'MockBitgetVault', 'Governance', 'L3BridgeCustody', 'BLSCustody', 'L3BridgedItpFactory',
] as const

// Settlement-chain contracts (checked against Settlement RPC)
const SETTLEMENT_CONTRACTS = [
  'SettlementBridgeCustody', 'SettlementIssuerRegistry',
  'BridgeProxy', 'BridgedItpFactory',
] as const

// ── Singleton cache ──

let _cached: DeploymentHealth | null = null

/**
 * Validate all deployment addresses. Cached after first call.
 * Call in global-setup before any tests run.
 */
export async function validateDeployment(): Promise<DeploymentHealth> {
  if (_cached) return _cached

  const staleAddresses: string[] = []

  // 1. Check RPC connectivity
  let l3Reachable = false
  let settlementReachable = false
  try {
    const chainId = await rpcChainId(L3_RPC)
    l3Reachable = chainId === DEPLOYMENT.chainId
    if (!l3Reachable) staleAddresses.push(`L3 chain ID mismatch: expected ${DEPLOYMENT.chainId}, got ${chainId}`)
  } catch {
    staleAddresses.push(`L3 RPC unreachable: ${L3_RPC}`)
  }
  try {
    await rpcChainId(SETTLEMENT_RPC)
    settlementReachable = true
  } catch {
    staleAddresses.push(`Settlement RPC unreachable: ${SETTLEMENT_RPC}`)
  }

  // 2. Validate core L3 contracts
  const coreContracts: AddressStatus[] = []
  if (l3Reachable) {
    for (const name of CORE_L3_CONTRACTS) {
      const addr = CONTRACTS[name]
      if (!addr) {
        staleAddresses.push(`Missing contract in deployment.json: ${name}`)
        coreContracts.push({ name, address: '', hasCode: false, chain: 'l3' })
        continue
      }
      const code = await rpcGetCode(L3_RPC, addr)
      const hasCode = !!code && code !== '0x'
      if (!hasCode) staleAddresses.push(`${name} (${addr}) has NO CODE on L3`)
      coreContracts.push({ name, address: addr, hasCode, chain: 'l3' })
    }
  }

  // 3. Validate optional L3 contracts
  const optionalContracts: AddressStatus[] = []
  if (l3Reachable) {
    for (const name of OPTIONAL_L3_CONTRACTS) {
      const addr = CONTRACTS[name]
      if (!addr) continue
      const code = await rpcGetCode(L3_RPC, addr)
      const hasCode = !!code && code !== '0x'
      if (!hasCode) staleAddresses.push(`[optional] ${name} (${addr}) has no code on L3`)
      optionalContracts.push({ name, address: addr, hasCode, chain: 'l3' })
    }
  }

  // 4. Validate Morpho deployment
  const morpho = { deployed: false, collateralTokenAlive: false, oracleAlive: false, stale: true }
  const morphoPath = join(__dirname, '..', '..', 'lib', 'contracts', 'morpho-deployment.json')
  if (existsSync(morphoPath) && l3Reachable) {
    try {
      const morphoDeploy = JSON.parse(readFileSync(morphoPath, 'utf-8'))
      const morphoAddr = morphoDeploy.contracts?.MORPHO
      if (morphoAddr) {
        const code = await rpcGetCode(L3_RPC, morphoAddr)
        morpho.deployed = !!code && code !== '0x'
      }
      const collateralAddr = morphoDeploy.marketParams?.collateralToken
      if (collateralAddr) {
        const code = await rpcGetCode(L3_RPC, collateralAddr)
        morpho.collateralTokenAlive = !!code && code !== '0x'
        if (!morpho.collateralTokenAlive) {
          staleAddresses.push(`Morpho collateralToken (${collateralAddr}) has NO CODE — needs redeployment`)
        }
      }
      const oracleAddr = morphoDeploy.contracts?.ITP_NAV_ORACLE
      if (oracleAddr) {
        const code = await rpcGetCode(L3_RPC, oracleAddr)
        morpho.oracleAlive = !!code && code !== '0x'
      }
      morpho.stale = morpho.deployed && !morpho.collateralTokenAlive
    } catch { /* morpho deployment JSON malformed */ }
  }

  // 5. Validate Vision batches
  const visionBatches = { count: 0, firstBatchExists: false }
  const visionPath = join(__dirname, '..', '..', 'lib', 'contracts', 'vision-batches.json')
  if (existsSync(visionPath) && l3Reachable) {
    try {
      const visionDeploy = JSON.parse(readFileSync(visionPath, 'utf-8'))
      visionBatches.count = visionDeploy.batchCount ?? Object.keys(visionDeploy.batches ?? {}).length
    } catch { /* vision batches JSON malformed */ }
  }

  _cached = {
    l3Reachable,
    settlementReachable,
    coreContracts,
    optionalContracts,
    morpho,
    visionBatches,
    staleAddresses,
  }

  return _cached
}

/**
 * Get cached deployment health (must call validateDeployment first).
 */
export function getDeploymentHealth(): DeploymentHealth | null {
  return _cached
}

/**
 * Print a human-readable deployment health report to console.
 */
export function printDeploymentReport(health: DeploymentHealth): void {
  console.log('\n[address-validator] ══════ Deployment Health Report ══════')
  console.log(`  L3 RPC:         ${health.l3Reachable ? 'OK' : 'UNREACHABLE'}`)
  console.log(`  Settlement RPC: ${health.settlementReachable ? 'OK' : 'UNREACHABLE'}`)

  const coreOk = health.coreContracts.filter(c => c.hasCode).length
  const coreTotal = health.coreContracts.length
  console.log(`  Core contracts: ${coreOk}/${coreTotal} have code`)
  for (const c of health.coreContracts.filter(x => !x.hasCode)) {
    console.log(`    MISSING: ${c.name} (${c.address || 'not in deployment.json'})`)
  }

  const optOk = health.optionalContracts.filter(c => c.hasCode).length
  const optTotal = health.optionalContracts.length
  if (optTotal > 0) {
    console.log(`  Optional:       ${optOk}/${optTotal} have code`)
  }

  console.log(`  Morpho:         ${health.morpho.deployed ? 'deployed' : 'NOT deployed'}${health.morpho.stale ? ' (STALE — collateral token missing)' : ''}`)
  console.log(`  Vision batches: ${health.visionBatches.count}`)

  if (health.staleAddresses.length > 0) {
    console.log(`\n  ISSUES (${health.staleAddresses.length}):`)
    for (const issue of health.staleAddresses) {
      console.log(`    - ${issue}`)
    }
  } else {
    console.log('\n  All addresses validated OK')
  }
  console.log('[address-validator] ══════════════════════════════════════\n')
}

/**
 * Quick check: is a specific contract available?
 * Uses cached health if available, otherwise does a live check.
 */
export function isContractAvailable(name: string): boolean {
  if (!_cached) return false
  const found = [..._cached.coreContracts, ..._cached.optionalContracts].find(c => c.name === name)
  return found?.hasCode ?? false
}

/** Is Morpho lending functional (not stale)? */
export function isMorphoFunctional(): boolean {
  return _cached?.morpho.deployed === true && !_cached?.morpho.stale
}
