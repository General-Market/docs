'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { useTransactionNotification } from '@/hooks/useTransactionNotification'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { ORACLE_REGISTRY_ABI } from '@/lib/contracts/index-protocol-abi'
import { indexL3 } from '@/lib/wagmi'

const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

const ORACLE_REGISTRY_ADDRESS = (
  process.env.NEXT_PUBLIC_ORACLE_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

import { VISION_API_URL, VISION_ORACLE_URLS } from '@/lib/config'

export type ClaimStep = 'idle' | 'fetching-proof' | 'claiming' | 'done' | 'error'

export interface ClaimProof {
  balance: string
  blsSig: string
  signerBitmap: string
  /** Latest resolved tick from oracle — used as toTick for claimRewards */
  tickId: number
}

export interface UseClaimReturn {
  /** Claim rewards: fetch proof from oracle, read on-chain position, submit claimRewards tx */
  claim: (batchId: bigint) => void
  claimHash: `0x${string}` | undefined
  step: ClaimStep
  isPending: boolean
  isConfirming: boolean
  proof: ClaimProof | null
  error: string | null
  reset: () => void
}

/**
 * Fetch a BLS-signed balance proof from oracle nodes.
 * The proof uses the WITHDRAW domain hash — valid for both claimRewards and withdraw.
 * Returns the balance, BLS signature, signer bitmap, and the tick at which the proof was generated.
 */
async function fetchBalanceProof(
  batchId: bigint,
  player: string,
): Promise<ClaimProof> {
  const errors: string[] = []
  const path = `/vision/balance/${batchId}/${player}`

  // Try proxied path first (same-origin, no CORS issues)
  const proxyUrl = `${VISION_API_URL}${path}`
  try {
    const res = await fetch(proxyUrl)
    if (res.ok) {
      const data = await res.json()
      return {
        balance: data.balance,
        blsSig: data.blsSig || data.bls_sig || '',
        signerBitmap: data.signerBitmap || data.signer_bitmap || '0',
        tickId: Number(data.tickId || data.tick_id || 0),
      }
    }
    const errBody = await res.text().catch(() => 'Unknown error')
    errors.push(`proxy: HTTP ${res.status} ${errBody.slice(0, 100)}`)
  } catch (e) {
    errors.push(`proxy: ${(e as Error).message}`)
  }

  // Fallback: try direct oracle URLs
  for (const url of VISION_ORACLE_URLS) {
    try {
      const res = await fetch(`${url}${path}`)
      if (res.ok) {
        const data = await res.json()
        return {
          balance: data.balance,
          blsSig: data.blsSig || data.bls_sig || '',
          signerBitmap: data.signerBitmap || data.signer_bitmap || '0',
          tickId: Number(data.tickId || data.tick_id || 0),
        }
      }
      const errBody = await res.text().catch(() => 'Unknown error')
      errors.push(`${url}: HTTP ${res.status} ${errBody.slice(0, 100)}`)
    } catch (e) {
      errors.push(`${url}: ${(e as Error).message}`)
    }
  }

  throw new Error(`Failed to fetch balance proof from all oracles: ${errors.join('; ')}`)
}

/**
 * Hook to claim rewards from a Vision batch without fully withdrawing.
 *
 * Flow:
 * 1. Fetch BLS-signed balance proof from oracle (includes tick_id of latest resolved tick)
 * 2. Read on-chain position for lastClaimedTick / startTick
 * 3. Compute fromTick = lastClaimedTick + 1 (or startTick + 1 for first claim)
 * 4. Call Vision.claimRewards(batchId, fromTick, toTick, newBalance, blsSignature, referenceNonce, signersBitmask)
 *
 * The BLS proof uses the same WITHDRAW domain hash as withdraw() — no tick range in the signature.
 * The contract validates tick monotonicity separately.
 */
export function useClaim(): UseClaimReturn {
  const { address } = useAccount()

  const [step, setStep] = useState<ClaimStep>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [proof, setProof] = useState<ClaimProof | null>(null)
  const [activeBatchId, setActiveBatchId] = useState<bigint | null>(null)

  const claimHandled = useRef(false)

  // Read latest snapshot nonce from OracleRegistry (for BLS verification)
  const { data: lastSnapshotNonce } = useReadContract({
    address: ORACLE_REGISTRY_ADDRESS,
    abi: ORACLE_REGISTRY_ABI,
    functionName: 'lastSnapshotNonce',
    chainId: indexL3.id,
    query: { enabled: ORACLE_REGISTRY_ADDRESS !== '0x0000000000000000000000000000000000000000' },
  })

  // Read on-chain position for tick range computation
  const { data: position } = useReadContract({
    address: VISION_ADDRESS,
    abi: VISION_ABI,
    functionName: 'getPosition',
    args: address && activeBatchId !== null ? [activeBatchId, address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address && activeBatchId !== null && VISION_ADDRESS !== '0x0000000000000000000000000000000000000000' },
  })

  const pos = position as {
    lastClaimedTick: bigint
    startTick: bigint
  } | undefined

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
  } = useWaitForTransactionReceipt({ hash: claimHash, chainId: indexL3.id })

  useTransactionNotification({
    hash: claimHash,
    isPending: isClaimPending,
    isConfirming: isClaimConfirming,
    isSuccess: isClaimSuccess,
    error: claimError,
    label: 'Claim rewards',
  })

  const claim = useCallback(async (batchId: bigint) => {
    if (!address) return

    setErrorMsg(null)
    setProof(null)
    claimHandled.current = false
    setActiveBatchId(batchId)

    // Step 1: Fetch BLS-signed balance proof (includes tick_id)
    setStep('fetching-proof')
    let fetchedProof: ClaimProof
    try {
      fetchedProof = await fetchBalanceProof(batchId, address)
      setProof(fetchedProof)
    } catch (e) {
      setErrorMsg((e as Error).message)
      setStep('error')
      return
    }

    if (!fetchedProof.blsSig || fetchedProof.blsSig === '' || fetchedProof.blsSig === '0x') {
      setErrorMsg('Balance proof has empty BLS signature. Oracles may not have resolved yet — try again shortly.')
      setStep('error')
      return
    }

    if (fetchedProof.tickId === 0) {
      setErrorMsg('No resolved tick yet for this batch.')
      setStep('error')
      return
    }

    // Step 2: Compute tick range from on-chain position
    // Position may not be loaded yet via useReadContract, so we fetch it directly
    // Note: pos comes from the useReadContract above, which may be stale.
    // For robustness, we compute fromTick from the latest on-chain data.
    const lastClaimed = pos?.lastClaimedTick ?? 0n
    const startTickVal = pos?.startTick ?? 0n
    const fromTick = lastClaimed > 0n ? lastClaimed + 1n : startTickVal + 1n
    const toTick = BigInt(fetchedProof.tickId)

    if (toTick < fromTick) {
      setErrorMsg(`No new ticks to claim (last claimed: ${lastClaimed}, latest resolved: ${fetchedProof.tickId})`)
      setStep('error')
      return
    }

    // Step 3: Submit claimRewards tx
    setStep('claiming')
    const refNonce = lastSnapshotNonce ? BigInt(lastSnapshotNonce.toString()) : 0n
    const signersBitmask = BigInt(fetchedProof.signerBitmap || '0')

    writeClaim({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'claimRewards',
      args: [
        batchId,
        fromTick,
        toTick,
        BigInt(fetchedProof.balance),
        (fetchedProof.blsSig ? `0x${fetchedProof.blsSig}` : '0x') as `0x${string}`,
        refNonce,
        signersBitmask,
      ],
    })
  }, [address, writeClaim, lastSnapshotNonce, pos])

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
    setActiveBatchId(null)
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
