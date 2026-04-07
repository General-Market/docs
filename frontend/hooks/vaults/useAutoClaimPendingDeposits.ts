'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { useSSEUserVaultPositions } from '@/hooks/useSSE'
import { indexL3 } from '@/lib/wagmi'

export interface AutoClaimState {
  /** The vault currently having its pending deposit claimed, if any. */
  claiming: `0x${string}` | null
  /** Count of vaults successfully auto-claimed in this session. */
  claimedCount: number
  /** Vaults that failed to claim (persisted to localStorage so we don't retry in a loop). */
  failedVaults: Set<string>
  /** Manually retry a failed vault. */
  retry: (vaultAddress: `0x${string}`) => void
}

// Track attempted claims per-wallet in localStorage so we don't keep hammering
// a vault that can't be claimed (e.g., contract reverted with "no pending"
// because a parallel tab already claimed it, or the vault is paused).
const failedKey = (addr: string) => `auto_claim_failed_${addr.toLowerCase()}`

function loadFailed(addr: string | undefined): Set<string> {
  if (!addr || typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(failedKey(addr))
    if (!raw) return new Set()
    const parsed: string[] = JSON.parse(raw)
    return new Set(parsed.map((v) => v.toLowerCase()))
  } catch {
    return new Set()
  }
}

function saveFailed(addr: string | undefined, set: Set<string>) {
  if (!addr || typeof window === 'undefined') return
  try {
    localStorage.setItem(failedKey(addr), JSON.stringify(Array.from(set)))
  } catch {
    /* quota exceeded — nothing sensible to do */
  }
}

/**
 * Scans the connected wallet's vault positions and automatically fires
 * `claimDeposit` on any vault with a non-zero `pending_deposit`.
 *
 * Rationale: `useVaultDeposit` runs approve → requestDeposit → claimDeposit
 * in one flow. If the user closes the tab mid-flow, the claim never happens
 * and the deposit sits pending forever. This hook is the self-healing
 * backstop: on every profile/vault visit, check the SSE stream and drain
 * any orphaned pending deposits into real shares.
 *
 * The hook is idempotent within a session and persists failures to
 * localStorage to prevent retry loops on a consistently-reverting vault.
 */
export function useAutoClaimPendingDeposits(enabled: boolean = true): AutoClaimState {
  const { address } = useAccount()
  const vaultPositions = useSSEUserVaultPositions()

  const [failedVaults, setFailedVaults] = useState<Set<string>>(() => loadFailed(address))
  const [claiming, setClaiming] = useState<`0x${string}` | null>(null)
  const [claimedCount, setClaimedCount] = useState(0)

  // Re-load failed set when the connected wallet changes.
  useEffect(() => {
    setFailedVaults(loadFailed(address))
  }, [address])

  const inFlightRef = useRef<`0x${string}` | null>(null)

  const {
    writeContract,
    data: txHash,
    error: writeError,
    reset: resetWrite,
  } = useChainWriteContract()

  const { isSuccess, isError: receiptError, isLoading: isConfirming } =
    useWaitForTransactionReceipt({ hash: txHash, chainId: indexL3.id })

  // Clear the in-flight marker + advance counters when a tx resolves.
  useEffect(() => {
    if (isSuccess && inFlightRef.current) {
      setClaimedCount((c) => c + 1)
      const done = inFlightRef.current
      inFlightRef.current = null
      setClaiming(null)
      resetWrite()
      // If the same vault is still showing a pending balance (the SSE stream
      // hasn't caught up yet) the next scan will pick it up — no special
      // handling needed here.
      void done
    }
  }, [isSuccess, resetWrite])

  // On write failure OR revert, mark the vault as failed and move on.
  useEffect(() => {
    if ((writeError || receiptError) && inFlightRef.current) {
      const failed = inFlightRef.current
      inFlightRef.current = null
      setClaiming(null)
      setFailedVaults((prev) => {
        const next = new Set(prev)
        next.add(failed.toLowerCase())
        saveFailed(address, next)
        return next
      })
      resetWrite()
    }
  }, [writeError, receiptError, address, resetWrite])

  const retry = useCallback(
    (vaultAddress: `0x${string}`) => {
      setFailedVaults((prev) => {
        const next = new Set(prev)
        next.delete(vaultAddress.toLowerCase())
        saveFailed(address, next)
        return next
      })
    },
    [address],
  )

  // The main scan loop: find the first claimable vault, fire the tx.
  useEffect(() => {
    if (!enabled || !address) return
    if (inFlightRef.current || isConfirming) return

    for (const [rawAddr, pos] of Object.entries(vaultPositions)) {
      const lower = rawAddr.toLowerCase()
      if (failedVaults.has(lower)) continue
      let pending = 0n
      try {
        pending = BigInt(pos.pending_deposit ?? '0')
      } catch {
        continue
      }
      if (pending === 0n) continue

      const vaultAddress = (rawAddr.startsWith('0x') ? rawAddr : `0x${rawAddr}`) as `0x${string}`
      inFlightRef.current = vaultAddress
      setClaiming(vaultAddress)
      writeContract({
        address: vaultAddress,
        abi: VISION_VAULT_ABI,
        functionName: 'claimDeposit',
        args: [address, address],
      })
      return // Only one at a time — the effect re-runs when the tx resolves.
    }
  }, [enabled, address, vaultPositions, failedVaults, isConfirming, writeContract])

  return {
    claiming,
    claimedCount,
    failedVaults,
    retry,
  }
}
