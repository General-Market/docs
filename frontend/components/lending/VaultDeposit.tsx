'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount, useReadContract } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'
import { useVaultDeposit } from '@/hooks/useVaultDeposit'
import { useMetaMorphoVault } from '@/hooks/useMetaMorphoVault'
import { indexL3 } from '@/lib/wagmi'
import { getTxUrl } from '@/lib/utils/explorer'

export function VaultDeposit() {
  const t = useTranslations('lending')
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
    chainId: indexL3.id,
    query: { enabled: !!address, refetchInterval: 10000 },
  })

  const {
    deposit,
    isApprovalNeeded,
    approve,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: actionError,
    reset,
    refetchAllowance,
  } = useVaultDeposit()

  const parsedAmount = amount ? parseUnits(amount, 18) : 0n
  const needsApproval = isApprovalNeeded(parsedAmount)
  const formattedBalance = usdcBalance ? formatUnits(usdcBalance as bigint, 18) : '0'
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
      setTxError(actionError.message || t('common.transaction_failed'))
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
    ? t('vault_deposit.button.approving')
    : isPending
    ? t('vault_deposit.button.confirm_wallet')
    : isConfirming
    ? t('vault_deposit.button.depositing')
    : step === 'success'
    ? t('vault_deposit.button.deposited')
    : needsApproval
    ? t('vault_deposit.button.approve_and_deposit')
    : t('vault_deposit.button.deposit_usdc')

  return (
    <div className="py-5">
      <div className="section-bar">
        <div>
          <div className="section-bar-title">{t('vault_deposit.section_title')}</div>
          <div className="section-bar-value">{t('vault_deposit.section_subtitle')}</div>
        </div>
      </div>

      <div className="border border-border-light border-t-0 p-5 space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-label font-semibold uppercase tracking-[0.08em] text-text-muted">{t('vault_deposit.amount_label')}</label>
            <span className="text-label text-text-muted font-mono tabular-nums">
              {t('vault_deposit.balance_label', { amount: parseFloat(formattedBalance).toFixed(2) })}
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
              className="w-full bg-muted border border-border-medium rounded-lg px-4 py-2.5 text-text-primary text-body font-mono tabular-nums focus:border-zinc-900 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => {
                const parsed = parseFloat(formattedBalance)
                setAmount((Math.floor(parsed * 100) / 100).toFixed(2))
              }}
              disabled={isProcessing}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-micro font-bold text-zinc-900 hover:text-zinc-700 disabled:opacity-50 uppercase tracking-[0.08em]"
            >
              {t('actions.max')}
            </button>
          </div>
          {amount && parsedAmount > (usdcBalance as bigint ?? 0n) && (
            <p className="text-color-down text-label mt-1">{t('vault_deposit.insufficient_balance')}</p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!amount || parsedAmount === 0n || isProcessing || parsedAmount > (usdcBalance as bigint ?? 0n)}
          className={`w-full py-2.5 font-bold text-caption uppercase tracking-[0.08em] transition-colors ${
            step === 'success'
              ? 'bg-color-up text-white'
              : 'bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-muted disabled:text-text-muted disabled:cursor-not-allowed'
          }`}
        >
          {buttonText}
        </button>

        {step === 'success' && txHash && (
          <a
            href={getTxUrl(txHash, 'l3')}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs text-text-muted font-mono hover:text-text-primary transition-colors"
          >
            {t('common.view_on_explorer')} ↗
          </a>
        )}

        {isProcessing && (
          <button
            onClick={handleCancel}
            className="w-full text-center text-label text-text-muted hover:text-text-secondary py-1 transition-colors"
          >
            {t('actions.cancel')}
          </button>
        )}

        {stuckWarning && (
          <div className="bg-orange-500/10 border border-orange-300 p-3 text-orange-700 text-caption">
            <p className="font-bold">{t('common.tx_stuck_title')}</p>
            <p className="text-label mt-1">{t('common.tx_stuck_description')}</p>
          </div>
        )}

        {txError && (
          <div className="bg-color-down/10 border border-color-down/30 p-3 text-color-down text-caption">
            {txError.includes('User rejected') || txError.includes('denied')
              ? t('common.transaction_rejected')
              : txError.length > 100
              ? txError.slice(0, 100) + '...'
              : txError}
          </div>
        )}
      </div>
    </div>
  )
}
