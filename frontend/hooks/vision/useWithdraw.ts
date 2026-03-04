'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { useTransactionNotification } from '@/hooks/useTransactionNotification'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { ISSUER_REGISTRY_ABI } from '@/lib/contracts/index-protocol-abi'
import { indexL3 } from '@/lib/wagmi'

const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

const ISSUER_REGISTRY_ADDRESS = (
  process.env.NEXT_PUBLIC_ISSUER_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

import { VISION_API_URL, VISION_ISSUER_URLS } from '@/lib/config'

export type WithdrawStep = 'idle' | 'fetching-proof' | 'withdrawing' | 'done' | 'error'

export interface BalanceProof {
  balance: string
  blsSig: string
  signerBitmap: string
}

export interface UseWithdrawReturn {
  /** Execute the full withdraw flow: fetch BLS proof -> withdraw tx */
  withdraw: (batchId: bigint) => void
  /** Withdraw tx hash */
  withdrawHash: `0x${string}` | undefined
  /** Current step */
  step: WithdrawStep
  /** Whether wallet prompt is pending */
  isPending: boolean
  /** Whether a tx is confirming on-chain */
  isConfirming: boolean
  /** The fetched balance proof (available after fetch) */
  proof: BalanceProof | null
  /** Error message if any */
  error: string | null
  /** Reset to idle state */
  reset: () => void
}

/**
 * Fetch a BLS-signed balance proof from issuer nodes.
 * Uses the Next.js proxy first (avoids CORS), then falls back to direct issuer URLs.
 */
async function fetchBalanceProof(
  batchId: bigint,
  player: string,
): Promise<BalanceProof> {
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
      }
    }
    const errBody = await res.text().catch(() => 'Unknown error')
    errors.push(`proxy: HTTP ${res.status} ${errBody.slice(0, 100)}`)
  } catch (e) {
    errors.push(`proxy: ${(e as Error).message}`)
  }

  // Fallback: try direct issuer URLs (works in non-browser contexts like E2E tests)
  for (const url of VISION_ISSUER_URLS) {
    try {
      const res = await fetch(`${url}${path}`)
      if (res.ok) {
        const data = await res.json()
        return {
          balance: data.balance,
          blsSig: data.blsSig || data.bls_sig || '',
          signerBitmap: data.signerBitmap || data.signer_bitmap || '0',
        }
      }
      const errBody = await res.text().catch(() => 'Unknown error')
      errors.push(`${url}: HTTP ${res.status} ${errBody.slice(0, 100)}`)
    } catch (e) {
      errors.push(`${url}: ${(e as Error).message}`)
    }
  }

  throw new Error(`Failed to fetch balance proof from all issuers: ${errors.join('; ')}`)
}

/**
 * Hook to withdraw from a Vision batch.
 *
 * Flow:
 * 1. Fetch BLS-signed balance proof from issuer node (pre-generated at tick end)
 * 2. Read referenceNonce from IssuerRegistry on-chain
 * 3. Call Vision.withdraw(batchId, finalBalance, blsSignature, referenceNonce, signersBitmask)
 *
 * The contract verifies the BLS signature, deducts 0.3% fee on profit,
 * and transfers remaining USDC back to the player.
 */
export function useWithdraw(): UseWithdrawReturn {
  const { address } = useAccount()

  const [step, setStep] = useState<WithdrawStep>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [proof, setProof] = useState<BalanceProof | null>(null)

  const withdrawHandled = useRef(false)

  // Read latest snapshot nonce from IssuerRegistry (for BLS verification)
  const { data: lastSnapshotNonce } = useReadContract({
    address: ISSUER_REGISTRY_ADDRESS,
    abi: ISSUER_REGISTRY_ABI,
    functionName: 'lastSnapshotNonce',
    chainId: indexL3.id,
    query: { enabled: ISSUER_REGISTRY_ADDRESS !== '0x0000000000000000000000000000000000000000' },
  })

  // --- Withdraw tx ---
  const {
    writeContract: writeWithdraw,
    data: withdrawHash,
    isPending: isWithdrawPending,
    error: withdrawError,
    reset: resetWithdraw,
  } = useChainWriteContract()
  const {
    isLoading: isWithdrawConfirming,
    isSuccess: isWithdrawSuccess,
    isError: isWithdrawReceiptError,
    error: withdrawReceiptError,
  } = useWaitForTransactionReceipt({ hash: withdrawHash })

  // Toast notifications for withdraw
  useTransactionNotification({
    hash: withdrawHash,
    isPending: isWithdrawPending,
    isConfirming: isWithdrawConfirming,
    isSuccess: isWithdrawSuccess,
    error: withdrawError,
    label: 'Batch withdraw',
  })

  const withdraw = useCallback(async (batchId: bigint) => {
    if (!address) return

    setErrorMsg(null)
    setProof(null)
    withdrawHandled.current = false

    // Step 1: Fetch BLS-signed balance proof (pre-generated at tick end)
    setStep('fetching-proof')
    let fetchedProof: BalanceProof
    try {
      fetchedProof = await fetchBalanceProof(batchId, address)
      setProof(fetchedProof)
    } catch (e) {
      setErrorMsg((e as Error).message)
      setStep('error')
      return
    }

    // Validate BLS proof before submitting
    if (!fetchedProof.blsSig || fetchedProof.blsSig === '' || fetchedProof.blsSig === '0x') {
      setErrorMsg('Balance proof has empty BLS signature. The issuers may not have signed yet — try again in a few seconds.')
      setStep('error')
      return
    }

    // Step 2: Submit withdraw tx with BLS proof + referenceNonce + signersBitmask
    setStep('withdrawing')
    const refNonce = lastSnapshotNonce ? BigInt(lastSnapshotNonce.toString()) : 0n
    const signersBitmask = BigInt(fetchedProof.signerBitmap || '0')

    writeWithdraw({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'withdraw',
      args: [
        batchId,
        BigInt(fetchedProof.balance),
        `0x${fetchedProof.blsSig}` as `0x${string}`,
        refNonce,
        signersBitmask,
      ],
    })
  }, [address, writeWithdraw, lastSnapshotNonce])

  // Withdraw success -> done
  useEffect(() => {
    if (!isWithdrawSuccess || withdrawHandled.current) return
    withdrawHandled.current = true
    setStep('done')
    resetWithdraw()
  }, [isWithdrawSuccess, resetWithdraw])

  // Error handling — writeContract simulation/submission error
  useEffect(() => {
    if (withdrawError) {
      const msg = withdrawError.message || 'Withdraw failed'
      setErrorMsg(msg.slice(0, 300))
      setStep('error')
      resetWithdraw()
    }
  }, [withdrawError, resetWithdraw])

  // Error handling — on-chain revert (TX submitted but reverted)
  useEffect(() => {
    if (isWithdrawReceiptError && withdrawReceiptError) {
      const msg = withdrawReceiptError.message || 'Transaction reverted on-chain'
      setErrorMsg(msg.slice(0, 300))
      setStep('error')
      resetWithdraw()
    }
  }, [isWithdrawReceiptError, withdrawReceiptError, resetWithdraw])

  const reset = useCallback(() => {
    setStep('idle')
    setErrorMsg(null)
    setProof(null)
    resetWithdraw()
  }, [resetWithdraw])

  return {
    withdraw,
    withdrawHash,
    step,
    isPending: isWithdrawPending,
    isConfirming: isWithdrawConfirming,
    proof,
    error: errorMsg,
    reset,
  }
}
