'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAccount, useSwitchChain, usePublicClient } from 'wagmi'
import { formatUnits } from 'viem'
import { useChainWriteContract, ensureCorrectChain } from '@/hooks/useChainWrite'
import { useToast } from '@/lib/contexts/ToastContext'
import { getTxUrl } from '@/lib/utils/explorer'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { useDeployment } from '@/hooks/useDeployment'
import { indexL3 } from '@/lib/wagmi'

const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

type Step = 'idle' | 'preparing' | 'approving' | 'depositing' | 'claiming' | 'done' | 'error'

export interface UseVaultDepositReturn {
  deposit: (vaultAddress: `0x${string}`, amount: bigint) => void
  step: Step
  isPending: boolean
  isConfirming: boolean
  error: string | null
  reset: () => void
  /**
   * Amount (USDC wei, 18 dec on L3) just deposited via a successful flow.
   * Stays non-zero for ~10s post-success so the UI can render an optimistic
   * position row while on-chain reads propagate. Accumulates across rapid
   * successive deposits — a second deposit in the optimistic window adds to
   * the prior amount rather than wiping it.
   */
  justDepositedAmount: bigint
  /**
   * Amount currently in flight (busy steps only). Non-zero from click until
   * either `done` or `error`. UI uses this to subtract from the displayed
   * wallet balance the moment the user clicks Deposit.
   */
  pendingAmount: bigint
}

function parseError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (!msg) return 'Transaction failed.'
  if (msg.includes('User rejected') || msg.includes('user rejected') || msg.includes('denied')) {
    return 'Transaction rejected in wallet.'
  }
  if (msg.includes('ERC20InsufficientBalance') || msg.includes('transfer amount exceeds balance')) {
    return 'Insufficient USDC balance.'
  }
  if (msg.includes('ERC20InsufficientAllowance') || msg.includes('allowance')) {
    return 'USDC allowance too low. Try again.'
  }
  if (msg.includes('timeout') || msg.includes('Timeout')) {
    return 'Transaction timed out. Check your wallet and try again.'
  }
  return msg.replace(/^ContractFunctionRevertedError:\s*/, '').slice(0, 200) || 'Transaction failed.'
}

/**
 * Three-tx vault join: approve → requestDeposit → claimDeposit.
 *
 * The flow runs as a single async function with try/catch error handling.
 * The earlier effect-driven version would hang if wagmi dropped a state
 * transition or if useWaitForTransactionReceipt stalled — either left the
 * UI glued to "Requesting deposit…" with nothing to unstick it. This version
 * awaits each step explicitly via publicClient.waitForTransactionReceipt and
 * surfaces every failure mode as a state transition to 'error'.
 */
export function useVaultDeposit(): UseVaultDepositReturn {
  const { address, chainId: currentChainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: indexL3.id })
  const { getAddress } = useDeployment()
  const usdcAddress = getAddress('L3_WUSDC')
  const { showCelebrate, showError } = useToast()

  const [step, setStep] = useState<Step>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [justDepositedAmount, setJustDepositedAmount] = useState<bigint>(0n)
  const [pendingAmount, setPendingAmount] = useState<bigint>(0n)

  const { writeContractAsync: writeApprove } = useChainWriteContract()
  const { writeContractAsync: writeDeposit } = useChainWriteContract()
  const { writeContractAsync: writeClaim } = useChainWriteContract()

  const deposit = useCallback(
    async (vaultAddress: `0x${string}`, amount: bigint) => {
      if (!address || !publicClient) return

      setErrorMsg(null)
      // Do NOT wipe justDepositedAmount here. A second deposit launched while
      // the prior optimistic row is still visible should accumulate, not
      // erase. The row decays on its own 10s timer per deposit.
      setIsConfirming(false)
      setPendingAmount(amount)
      // Flip to a busy state synchronously so the button reacts the moment
      // the user clicks, before chain-switch + allowance-read (~500ms) have
      // had a chance to decide which real step comes next.
      setStep('preparing')
      setIsPending(true)

      try {
        await ensureCorrectChain(currentChainId, switchChainAsync)
      } catch {
        setErrorMsg('Could not switch to Index L3.')
        setStep('error')
        setIsPending(false)
        return
      }

      // Always read fresh allowance right before deciding to approve — the
      // cached useReadContract value would be stale across repeated deposits.
      let currentAllowance: bigint
      try {
        currentAllowance = (await publicClient.readContract({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, vaultAddress],
        })) as bigint
      } catch (err) {
        setErrorMsg(parseError(err))
        setStep('error')
        setIsPending(false)
        setPendingAmount(0n)
        return
      }

      let finalHash: `0x${string}` | undefined
      try {
        // ─── 1. Approve (skipped if allowance already sufficient) ───
        if (currentAllowance < amount) {
          setStep('approving')
          setIsPending(true)
          const approveHash = await writeApprove({
            address: usdcAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [vaultAddress, amount],
          })
          setIsPending(false)
          setIsConfirming(true)
          await publicClient.waitForTransactionReceipt({ hash: approveHash })
          setIsConfirming(false)
          // Intermediate step — no toast. Three "X confirmed" pops in a row
          // is noise. The single celebrate toast at the end carries weight.
        }

        // ─── 2. Request deposit ───
        setStep('depositing')
        setIsPending(true)
        const depositHash = await writeDeposit({
          address: vaultAddress,
          abi: VISION_VAULT_ABI,
          functionName: 'requestDeposit',
          args: [amount, address, address],
        })
        setIsPending(false)
        setIsConfirming(true)
        await publicClient.waitForTransactionReceipt({ hash: depositHash })
        setIsConfirming(false)

        // ─── 3. Claim deposit (mints shares) ───
        setStep('claiming')
        setIsPending(true)
        const claimHash = await writeClaim({
          address: vaultAddress,
          abi: VISION_VAULT_ABI,
          functionName: 'claimDeposit',
          args: [address, address],
        })
        finalHash = claimHash
        setIsPending(false)
        setIsConfirming(true)
        await publicClient.waitForTransactionReceipt({ hash: claimHash })
        setIsConfirming(false)

        // ─── Done ───
        setStep('done')
        setJustDepositedAmount(prev => prev + amount)
        setPendingAmount(0n)
        const human = parseFloat(formatUnits(amount, 18))
        const url = finalHash ? getTxUrl(finalHash, 'l3') : undefined
        showCelebrate(
          `Deposited $${human.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          'Shares minted.',
          url ? { url, text: 'View transaction' } : undefined,
        )
        // Broadcast to any cross-component listeners (onboarding guide,
        // portfolio widgets, etc.) so they refetch without waiting for
        // their own poll cadence.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('vault-deposit-success', {
              detail: { vault: vaultAddress, amount: amount.toString() },
            }),
          )
        }
      } catch (err) {
        const parsed = parseError(err)
        setErrorMsg(parsed)
        setStep('error')
        setIsPending(false)
        setIsConfirming(false)
        setPendingAmount(0n)
        showError(parsed)
      }
    },
    [
      address,
      publicClient,
      currentChainId,
      switchChainAsync,
      usdcAddress,
      writeApprove,
      writeDeposit,
      writeClaim,
      showCelebrate,
      showError,
    ],
  )

  // Auto-return to idle a few seconds after success so the button is usable
  // again. Keep the optimistic amount alive a little longer for the UI's
  // position overlay.
  useEffect(() => {
    if (step !== 'done') return
    const idleTimer = setTimeout(() => {
      setStep(prev => (prev === 'done' ? 'idle' : prev))
    }, 3500)
    const clearTimer = setTimeout(() => {
      setJustDepositedAmount(0n)
    }, 10_000)
    return () => {
      clearTimeout(idleTimer)
      clearTimeout(clearTimer)
    }
  }, [step])

  const reset = useCallback(() => {
    setStep('idle')
    setErrorMsg(null)
    setJustDepositedAmount(0n)
    setPendingAmount(0n)
    setIsPending(false)
    setIsConfirming(false)
  }, [])

  return {
    deposit,
    step,
    isPending,
    isConfirming,
    error: errorMsg,
    reset,
    justDepositedAmount,
    pendingAmount,
  }
}
