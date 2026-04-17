'use client'

import { useEffect, useMemo } from 'react'
import { useReadContracts } from '@/lib/wallet-shim'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { indexL3 } from '@/lib/wagmi'
import fundData from '@/data/fund-branding.json'

/**
 * Authoritative, instant, on-chain read of the connected wallet's vault
 * positions. Multicalls `balanceOf(user)` and `pendingDepositRequest(0, user)`
 * across every vault in `fund-branding.json` and returns maps keyed by the
 * lowercased vault address.
 *
 * Why this and not SSE:
 *   - `data-node`'s vault-position poller runs off a file loaded at process
 *     start. Any vault deployed after the last restart is invisible.
 *   - The poller scopes to 3s and skips zero entries, so a user who just
 *     deposited sees nothing for up to one cycle + SSE propagation.
 *   - Bugs in the poller (we've hit a few) silently hide real balances.
 *
 * This hook listens for the `vault-deposit-success` window CustomEvent that
 * `useVaultDeposit` fires on claim confirmation, so UI wired to it updates
 * within ~1s of the final tx instead of waiting for the next poll interval.
 */

const CHUNK_SIZE = 50

export interface OnChainVaultPositions {
  /** Map of lowercased vault address → user shares (bigint, 18 dec). */
  shares: Map<string, bigint>
  /** Map of lowercased vault address → user pending deposit (bigint, 18 dec). */
  pending: Map<string, bigint>
  /** True once every enabled multicall chunk has completed its first fetch. */
  isChecked: boolean
  /** Force an immediate refetch of every chunk. */
  refetch: () => void
}

// Snapshot of vault addresses — fund-branding.json is static at build time.
const VAULT_ADDRESSES: `0x${string}`[] = (fundData as { funds: Array<{ vault?: string }> })
  .funds.filter((f) => !!f.vault)
  .map((f) => (f.vault as string).toLowerCase() as `0x${string}`)

export function useOnChainVaultPositions(
  userAddress: `0x${string}` | undefined,
): OnChainVaultPositions {
  // Build the two call arrays once per user address.
  const balanceCalls = useMemo(() => {
    if (!userAddress) return []
    return VAULT_ADDRESSES.map((vaultAddr) => ({
      address: vaultAddr,
      abi: VISION_VAULT_ABI,
      functionName: 'balanceOf' as const,
      args: [userAddress],
      chainId: indexL3.id,
    }))
  }, [userAddress])

  const pendingCalls = useMemo(() => {
    if (!userAddress) return []
    return VAULT_ADDRESSES.map((vaultAddr) => ({
      address: vaultAddr,
      abi: VISION_VAULT_ABI,
      functionName: 'pendingDepositRequest' as const,
      args: [0n, userAddress],
      chainId: indexL3.id,
    }))
  }, [userAddress])

  // ─── balanceOf chunks ───
  const b0Calls = balanceCalls.slice(0, CHUNK_SIZE)
  const b1Calls = balanceCalls.slice(CHUNK_SIZE, CHUNK_SIZE * 2)
  const b2Calls = balanceCalls.slice(CHUNK_SIZE * 2, CHUNK_SIZE * 3)
  const b3Calls = balanceCalls.slice(CHUNK_SIZE * 3, CHUNK_SIZE * 4)

  const b0 = useReadContracts({
    contracts: b0Calls as any,
    allowFailure: true,
    query: { enabled: b0Calls.length > 0, refetchInterval: 6000 },
  })
  const b1 = useReadContracts({
    contracts: b1Calls as any,
    allowFailure: true,
    query: { enabled: b1Calls.length > 0, refetchInterval: 6000 },
  })
  const b2 = useReadContracts({
    contracts: b2Calls as any,
    allowFailure: true,
    query: { enabled: b2Calls.length > 0, refetchInterval: 6000 },
  })
  const b3 = useReadContracts({
    contracts: b3Calls as any,
    allowFailure: true,
    query: { enabled: b3Calls.length > 0, refetchInterval: 6000 },
  })

  // ─── pendingDepositRequest chunks ───
  const p0Calls = pendingCalls.slice(0, CHUNK_SIZE)
  const p1Calls = pendingCalls.slice(CHUNK_SIZE, CHUNK_SIZE * 2)
  const p2Calls = pendingCalls.slice(CHUNK_SIZE * 2, CHUNK_SIZE * 3)
  const p3Calls = pendingCalls.slice(CHUNK_SIZE * 3, CHUNK_SIZE * 4)

  const p0 = useReadContracts({
    contracts: p0Calls as any,
    allowFailure: true,
    query: { enabled: p0Calls.length > 0, refetchInterval: 6000 },
  })
  const p1 = useReadContracts({
    contracts: p1Calls as any,
    allowFailure: true,
    query: { enabled: p1Calls.length > 0, refetchInterval: 6000 },
  })
  const p2 = useReadContracts({
    contracts: p2Calls as any,
    allowFailure: true,
    query: { enabled: p2Calls.length > 0, refetchInterval: 6000 },
  })
  const p3 = useReadContracts({
    contracts: p3Calls as any,
    allowFailure: true,
    query: { enabled: p3Calls.length > 0, refetchInterval: 6000 },
  })

  const refetchB0 = b0.refetch
  const refetchB1 = b1.refetch
  const refetchB2 = b2.refetch
  const refetchB3 = b3.refetch
  const refetchP0 = p0.refetch
  const refetchP1 = p1.refetch
  const refetchP2 = p2.refetch
  const refetchP3 = p3.refetch

  const refetch = useMemo(
    () => () => {
      refetchB0()
      refetchB1()
      refetchB2()
      refetchB3()
      refetchP0()
      refetchP1()
      refetchP2()
      refetchP3()
    },
    [refetchB0, refetchB1, refetchB2, refetchB3, refetchP0, refetchP1, refetchP2, refetchP3],
  )

  // Instant refetch when useVaultDeposit fires its success event.
  useEffect(() => {
    const handler = () => refetch()
    window.addEventListener('vault-deposit-success', handler)
    return () => window.removeEventListener('vault-deposit-success', handler)
  }, [refetch])

  // Assemble the result maps.
  const result = useMemo<OnChainVaultPositions>(() => {
    const shares = new Map<string, bigint>()
    const pending = new Map<string, bigint>()

    if (!userAddress) {
      return { shares, pending, isChecked: true, refetch }
    }

    const balanceChunks = [b0, b1, b2, b3]
    const pendingChunks = [p0, p1, p2, p3]

    // Walk balances chunk-by-chunk to stay aligned with VAULT_ADDRESSES.
    let cursor = 0
    for (const chunk of balanceChunks) {
      const data = chunk.data as Array<{ status: string; result?: unknown }> | undefined
      if (!data) {
        cursor += CHUNK_SIZE
        continue
      }
      for (let i = 0; i < data.length; i++) {
        const entry = data[i]
        if (entry?.status !== 'success') continue
        const bal = entry.result as bigint | undefined
        if (bal === undefined || bal === 0n) continue
        const addr = VAULT_ADDRESSES[cursor + i]
        if (!addr) continue
        shares.set(addr.toLowerCase(), bal)
      }
      cursor += CHUNK_SIZE
    }

    cursor = 0
    for (const chunk of pendingChunks) {
      const data = chunk.data as Array<{ status: string; result?: unknown }> | undefined
      if (!data) {
        cursor += CHUNK_SIZE
        continue
      }
      for (let i = 0; i < data.length; i++) {
        const entry = data[i]
        if (entry?.status !== 'success') continue
        const val = entry.result as bigint | undefined
        if (val === undefined || val === 0n) continue
        const addr = VAULT_ADDRESSES[cursor + i]
        if (!addr) continue
        pending.set(addr.toLowerCase(), val)
      }
      cursor += CHUNK_SIZE
    }

    const isChecked =
      (b0Calls.length === 0 || b0.isFetched) &&
      (b1Calls.length === 0 || b1.isFetched) &&
      (b2Calls.length === 0 || b2.isFetched) &&
      (b3Calls.length === 0 || b3.isFetched) &&
      (p0Calls.length === 0 || p0.isFetched) &&
      (p1Calls.length === 0 || p1.isFetched) &&
      (p2Calls.length === 0 || p2.isFetched) &&
      (p3Calls.length === 0 || p3.isFetched)

    return { shares, pending, isChecked, refetch }
  }, [
    userAddress,
    refetch,
    b0.data, b1.data, b2.data, b3.data,
    p0.data, p1.data, p2.data, p3.data,
    b0.isFetched, b1.isFetched, b2.isFetched, b3.isFetched,
    p0.isFetched, p1.isFetched, p2.isFetched, p3.isFetched,
    b0Calls.length, b1Calls.length, b2Calls.length, b3Calls.length,
    p0Calls.length, p1Calls.length, p2Calls.length, p3Calls.length,
  ])

  return result
}
