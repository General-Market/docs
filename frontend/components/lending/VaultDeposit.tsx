'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'
import { useVaultDeposit } from '@/hooks/useVaultDeposit'
import { useMetaMorphoVault } from '@/hooks/useMetaMorphoVault'

/**
 * VaultDeposit component (AC7)
 *
 * Allows USDC lenders to deposit into the MetaMorpho vault.
 * Handles approval flow and tracks vault shares.
 */
export function VaultDeposit() {
  const { address } = useAccount()
  const [amount, setAmount] = useState('')
  const [txError, setTxError] = useState<string | null>(null)
  const [step, setStep] = useState<'input' | 'approving' | 'depositing' | 'success'>('input')

  const { refetch: refetchVault } = useMetaMorphoVault()

  // Fetch user's USDC balance
  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: MORPHO_ADDRESSES.loanToken,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10000 },
  })

  const {
    deposit,
    isApprovalNeeded,
    approve,
    allowance,
    isPending,
    isConfirming,
    isSuccess,
    error: actionError,
    reset,
    refetchAllowance,
  } = useVaultDeposit()

  const parsedAmount = amount ? parseUnits(amount, 6) : 0n
  const needsApproval = isApprovalNeeded(parsedAmount)
  const formattedBalance = usdcBalance ? formatUnits(usdcBalance as bigint, 6) : '0'
  const [pendingDepositAmount, setPendingDepositAmount] = useState<bigint>(0n)

  // Track success state
  const successHandled = useRef(false)
  const approvalHandled = useRef(false)

  // Watch for approval completion to trigger deposit
  useEffect(() => {
    if (step === 'approving' && isSuccess && pendingDepositAmount > 0n && !approvalHandled.current) {
      // Approval TX confirmed — refetch allowance then deposit
      approvalHandled.current = true
      refetchAllowance()
      setTimeout(() => {
        reset()
        setStep('depositing')
        deposit(pendingDepositAmount)
      }, 500)
    }
  }, [step, isSuccess, pendingDepositAmount, refetchAllowance, reset, deposit])

  useEffect(() => {
    if (isSuccess && !successHandled.current && step === 'depositing') {
      successHandled.current = true
      setStep('success')
      refetchBalance()
      refetchAllowance()
      refetchVault()
      setTimeout(() => {
        setStep('input')
        setAmount('')
        setPendingDepositAmount(0n)
        reset()
        successHandled.current = false
        approvalHandled.current = false
      }, 2000)
    }
  }, [isSuccess, step, refetchBalance, refetchAllowance, refetchVault, reset])

  useEffect(() => {
    if (actionError) {
      setTxError(actionError.message || 'Transaction failed')
      setStep('input')
      setPendingDepositAmount(0n)
      approvalHandled.current = false
      reset()
    }
  }, [actionError, reset])

  const handleDeposit = useCallback(() => {
    if (!amount || parsedAmount === 0n) return
    successHandled.current = false
    setTxError(null)
    setStep('depositing')
    deposit(parsedAmount)
  }, [amount, parsedAmount, deposit])

  const handleApprove = useCallback(() => {
    if (!amount || parsedAmount === 0n) return
    setTxError(null)
    setStep('approving')
    setPendingDepositAmount(parsedAmount)
    approvalHandled.current = false
    approve(parsedAmount * 2n)
  }, [amount, parsedAmount, approve])

  const handleSubmit = () => {
    if (needsApproval) {
      handleApprove()
    } else {
      handleDeposit()
    }
  }

  const [stuckWarning, setStuckWarning] = useState(false)

  // Detect stuck transactions — warn after 30s of confirming
  useEffect(() => {
    if (!isConfirming && step !== 'approving') {
      setStuckWarning(false)
      return
    }
    const timer = setTimeout(() => setStuckWarning(true), 30_000)
    return () => clearTimeout(timer)
  }, [isConfirming, step])

  const handleCancel = useCallback(() => {
    reset()
    setStep('input')
    setTxError(null)
    setStuckWarning(false)
    setPendingDepositAmount(0n)
    successHandled.current = false
    approvalHandled.current = false
  }, [reset])

  const isProcessing = isPending || isConfirming || step === 'approving'

  const buttonText = step === 'approving'
    ? 'Approving USDC...'
    : isPending
    ? 'Confirm in wallet...'
    : isConfirming
    ? 'Depositing...'
    : step === 'success'
    ? 'Deposited!'
    : needsApproval
    ? 'Approve & Deposit'
    : 'Deposit USDC'

  return (
    <div className="bg-terminal-dark border border-white/10 rounded-lg p-6">
      <h2 className="text-lg font-bold text-white mb-4">Deposit to Vault</h2>
      <p className="text-white/60 text-sm mb-4">
        Deposit USDC to earn yield from borrowers
      </p>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-white/70">Amount (USDC)</label>
            <span className="text-xs text-white/40">
              Balance: {parseFloat(formattedBalance).toFixed(2)} USDC
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="1"
              disabled={isProcessing}
              className="w-full bg-terminal border border-white/20 rounded px-4 py-3 text-white text-lg focus:border-accent focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => setAmount(formattedBalance)}
              disabled={isProcessing}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-accent hover:text-accent/80 disabled:opacity-50"
            >
              MAX
            </button>
          </div>
          {amount && parsedAmount > (usdcBalance as bigint ?? 0n) && (
            <p className="text-red-400 text-xs mt-1">Insufficient USDC balance</p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!amount || parsedAmount === 0n || isProcessing || parsedAmount > (usdcBalance as bigint ?? 0n)}
          className={`w-full py-3 font-bold rounded-lg transition-colors ${
            step === 'success'
              ? 'bg-green-500 text-white'
              : 'bg-accent text-terminal hover:bg-accent/90 disabled:bg-white/20 disabled:text-white/50 disabled:cursor-not-allowed'
          }`}
        >
          {buttonText}
        </button>

        {isProcessing && (
          <button
            onClick={handleCancel}
            className="w-full text-center text-sm text-white/50 hover:text-white/80 py-2 transition-colors"
          >
            Cancel
          </button>
        )}

        {stuckWarning && (
          <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-sm">
            <p className="font-bold">Transaction may be stuck</p>
            <p className="text-xs mt-1">Not confirmed after 30s. You can cancel and try again.</p>
          </div>
        )}

        {txError && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
            {txError.includes('User rejected') || txError.includes('denied')
              ? 'Transaction rejected'
              : txError.length > 100
              ? txError.slice(0, 100) + '...'
              : txError}
          </div>
        )}
      </div>
    </div>
  )
}
