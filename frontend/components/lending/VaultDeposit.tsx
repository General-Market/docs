'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'
import { useVaultDeposit } from '@/hooks/useVaultDeposit'
import { useMetaMorphoVault } from '@/hooks/useMetaMorphoVault'

export function VaultDeposit() {
  const { address } = useAccount()
  const [amount, setAmount] = useState('')
  const [txError, setTxError] = useState<string | null>(null)
  const [step, setStep] = useState<'input' | 'approving' | 'depositing' | 'success'>('input')

  const { refetch: refetchVault } = useMetaMorphoVault()

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

  const successHandled = useRef(false)
  const approvalHandled = useRef(false)

  useEffect(() => {
    if (step === 'approving' && isSuccess && pendingDepositAmount > 0n && !approvalHandled.current) {
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
    <div className="py-5">
      <div className="section-bar">
        <div>
          <div className="section-bar-title">Deposit</div>
          <div className="section-bar-value">Supply USDC to Vault</div>
        </div>
      </div>

      <div className="border border-border-light border-t-0 p-5 space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">Amount (USDC)</label>
            <span className="text-[11px] text-text-muted font-mono tabular-nums">
              Balance: {parseFloat(formattedBalance).toFixed(2)}
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
              className="w-full bg-muted border border-border-medium rounded-lg px-4 py-2.5 text-text-primary text-[15px] font-mono tabular-nums focus:border-zinc-900 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => setAmount(formattedBalance)}
              disabled={isProcessing}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-900 hover:text-zinc-700 disabled:opacity-50 uppercase tracking-wider"
            >
              Max
            </button>
          </div>
          {amount && parsedAmount > (usdcBalance as bigint ?? 0n) && (
            <p className="text-color-down text-[11px] mt-1">Insufficient USDC balance</p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!amount || parsedAmount === 0n || isProcessing || parsedAmount > (usdcBalance as bigint ?? 0n)}
          className={`w-full py-2.5 font-bold text-[13px] uppercase tracking-[0.06em] transition-colors ${
            step === 'success'
              ? 'bg-color-up text-white'
              : 'bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-muted disabled:text-text-muted disabled:cursor-not-allowed'
          }`}
        >
          {buttonText}
        </button>

        {isProcessing && (
          <button
            onClick={handleCancel}
            className="w-full text-center text-[11px] text-text-muted hover:text-text-secondary py-1 transition-colors"
          >
            Cancel
          </button>
        )}

        {stuckWarning && (
          <div className="bg-orange-500/10 border border-orange-300 p-3 text-orange-700 text-[12px]">
            <p className="font-bold">Transaction may be stuck</p>
            <p className="text-[11px] mt-1">Not confirmed after 30s. You can cancel and try again.</p>
          </div>
        )}

        {txError && (
          <div className="bg-color-down/10 border border-color-down/30 p-3 text-color-down text-[12px]">
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
