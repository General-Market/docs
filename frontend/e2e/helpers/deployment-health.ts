/**
 * Fast deployment health access for test workers.
 * Reads the cached health from global-setup (avoids re-validating per test).
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { DeploymentHealth } from './address-validator'

let _health: DeploymentHealth | null = null

function load(): DeploymentHealth | null {
  if (_health) return _health
  const path = join(__dirname, '..', '.deployment-health.json')
  if (!existsSync(path)) return null
  try {
    _health = JSON.parse(readFileSync(path, 'utf-8'))
    return _health
  } catch {
    return null
  }
}

/** Is a named contract deployed and has code? */
export function hasContract(name: string): boolean {
  const h = load()
  if (!h) return true // optimistic if no health file (e.g. running single test)
  return [...h.coreContracts, ...h.optionalContracts].find(c => c.name === name)?.hasCode ?? false
}

/** Is Morpho fully functional (deployed + collateral token alive)? */
export function morphoReady(): boolean {
  const h = load()
  if (!h) return false
  return h.morpho.deployed && h.morpho.collateralTokenAlive
}

/** Is Morpho deployed at all (even if stale)? */
export function morphoDeployed(): boolean {
  const h = load()
  if (!h) return false
  return h.morpho.deployed
}

/** Get full deployment health (for detailed checks) */
export function getHealth(): DeploymentHealth | null {
  return load()
}

/** List of all stale/missing address issues */
export function getIssues(): string[] {
  return load()?.staleAddresses ?? []
}
