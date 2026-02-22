'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { VISION_ABI } from '@/lib/contracts/vision-abi'

const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

import { P2POOL_ISSUER_URLS } from '@/lib/config'

export type WithdrawStep = 'idle' | 'fetching-proof' | 'withdrawing' | 'done' | 'error'

export interface BalanceProof {
  balance: string
  blsSig: string
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
 * Tries each issuer URL until one succeeds.
 */
async function fetchBalanceProof(
  batchId: bigint,
  player: string,
): Promise<BalanceProof> {
  const errors: string[] = []

  for (const url of P2POOL_ISSUER_URLS) {
    try {
      const res = await fetch(`${url}/p2pool/balance/${batchId}/${player}`)
      if (res.ok) {
        const data = await res.json()
        return {
          balance: data.balance,
          blsSig: data.blsSig || data.bls_sig,
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
 * Hook to withdraw from a P2Pool batch.
 *
 * Flow:
 * 1. Fetch BLS-signed balance proof from issuer node
 * 2. Call Vision.withdraw(batchId, finalBalance, blsSignature)
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
  } = useWaitForTransactionReceipt({ hash: withdrawHash })

  const withdraw = useCallback(async (batchId: bigint) => {
    if (!address) return

    setErrorMsg(null)
    setProof(null)
    withdrawHandled.current = false

    // Step 1: Fetch BLS-signed balance proof
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

    // Step 2: Submit withdraw tx
    setStep('withdrawing')
    writeWithdraw({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'withdraw',
      args: [
        batchId,
        BigInt(fetchedProof.balance),
        fetchedProof.blsSig as `0x${string}`,
      ],
    })
  }, [address, writeWithdraw])

  // Withdraw success -> done
  useEffect(() => {
    if (!isWithdrawSuccess || withdrawHandled.current) return
    withdrawHandled.current = true
    setStep('done')
    resetWithdraw()
  }, [isWithdrawSuccess, resetWithdraw])

  // Error handling
  useEffect(() => {
    if (withdrawError) {
      const msg = withdrawError.message || 'Withdraw failed'
      setErrorMsg(msg.slice(0, 300))
      setStep('error')
      resetWithdraw()
    }
  }, [withdrawError, resetWithdraw])

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
