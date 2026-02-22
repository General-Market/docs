'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { VISION_ABI } from '@/lib/contracts/vision-abi'

const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

/**
 * Issuer node URLs for fetching BLS-signed balance proofs.
 */
const ISSUER_URLS = (
  process.env.NEXT_PUBLIC_ISSUER_URLS ||
  'http://localhost:9001,http://localhost:9002,http://localhost:9003'
).split(',').map(u => u.trim()).filter(Boolean)

export type ClaimStep = 'idle' | 'fetching-proof' | 'claiming' | 'done' | 'error'

export interface ClaimProof {
  balance: string
  blsSig: string
  fromTick: number
  toTick: number
}

export interface UseClaimReturn {
  /** Execute the full claim flow: fetch BLS proof -> claimRewards tx */
  claim: (batchId: bigint, fromTick: bigint, toTick: bigint) => void
  /** Claim tx hash */
  claimHash: `0x${string}` | undefined
  /** Current step */
  step: ClaimStep
  /** Whether wallet prompt is pending */
  isPending: boolean
  /** Whether a tx is confirming on-chain */
  isConfirming: boolean
  /** The fetched claim proof (available after fetch) */
  proof: ClaimProof | null
  /** Error message if any */
  error: string | null
  /** Reset to idle state */
  reset: () => void
}

/**
 * Fetch a BLS-signed balance proof for a tick range from issuer nodes.
 * Tries each issuer URL until one succeeds.
 */
async function fetchClaimProof(
  batchId: bigint,
  player: string,
  fromTick: bigint,
  toTick: bigint,
): Promise<ClaimProof> {
  const errors: string[] = []

  for (const url of ISSUER_URLS) {
    try {
      const res = await fetch(
        `${url}/p2pool/balance/${batchId}/${player}?fromTick=${fromTick}&toTick=${toTick}`
      )
      if (res.ok) {
        const data = await res.json()
        return {
          balance: data.balance,
          blsSig: data.blsSig || data.bls_sig,
          fromTick: Number(fromTick),
          toTick: Number(toTick),
        }
      }
      const errBody = await res.text().catch(() => 'Unknown error')
      errors.push(`${url}: HTTP ${res.status} ${errBody.slice(0, 100)}`)
    } catch (e) {
      errors.push(`${url}: ${(e as Error).message}`)
    }
  }

  throw new Error(`Failed to fetch claim proof from all issuers: ${errors.join('; ')}`)
}

/**
 * Hook to claim rewards from a P2Pool batch without fully withdrawing.
 *
 * Flow:
 * 1. Fetch BLS-signed balance proof from issuer node (with tick range)
 * 2. Call Vision.claimRewards(batchId, fromTick, toTick, newBalance, blsSignature)
 *
 * Tick range: from lastClaimedTick+1 to current resolved tick.
 * The contract verifies the BLS signature and updates the player's balance.
 */
export function useClaim(): UseClaimReturn {
  const { address } = useAccount()

  const [step, setStep] = useState<ClaimStep>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [proof, setProof] = useState<ClaimProof | null>(null)

  const claimHandled = useRef(false)

  // --- Claim tx ---
  const {
    writeContract: writeClaim,
    data: claimHash,
    isPending: isClaimPending,
    error: claimError,
    reset: resetClaim,
  } = useChainWriteContract()
  const {
    isLoading: isClaimConfirming,
    isSuccess: isClaimSuccess,
  } = useWaitForTransactionReceipt({ hash: claimHash })

  const claim = useCallback(async (batchId: bigint, fromTick: bigint, toTick: bigint) => {
    if (!address) return

    setErrorMsg(null)
    setProof(null)
    claimHandled.current = false

    // Step 1: Fetch BLS-signed balance proof for tick range
    setStep('fetching-proof')
    let fetchedProof: ClaimProof
    try {
      fetchedProof = await fetchClaimProof(batchId, address, fromTick, toTick)
      setProof(fetchedProof)
    } catch (e) {
      setErrorMsg((e as Error).message)
      setStep('error')
      return
    }

    // Step 2: Submit claimRewards tx
    setStep('claiming')
    writeClaim({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'claimRewards',
      args: [
        batchId,
        fromTick,
        toTick,
        BigInt(fetchedProof.balance),
        fetchedProof.blsSig as `0x${string}`,
      ],
    })
  }, [address, writeClaim])

  // Claim success -> done
  useEffect(() => {
    if (!isClaimSuccess || claimHandled.current) return
    claimHandled.current = true
    setStep('done')
    resetClaim()
  }, [isClaimSuccess, resetClaim])

  // Error handling
  useEffect(() => {
    if (claimError) {
      const msg = claimError.message || 'Claim failed'
      setErrorMsg(msg.slice(0, 300))
      setStep('error')
      resetClaim()
    }
  }, [claimError, resetClaim])

  const reset = useCallback(() => {
    setStep('idle')
    setErrorMsg(null)
    setProof(null)
    resetClaim()
  }, [resetClaim])

  return {
    claim,
    claimHash,
    step,
    isPending: isClaimPending,
    isConfirming: isClaimConfirming,
    proof,
    error: errorMsg,
    reset,
  }
}
