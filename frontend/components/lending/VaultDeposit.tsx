'use client'

import { useState, useCallback, useEffect, useRef, type CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount, useReadContract } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'
import { useVaultDeposit } from '@/hooks/useVaultDeposit'
import { useMetaMorphoVault } from '@/hooks/useMetaMorphoVault'
import { useToast } from '@/lib/contexts/ToastContext'
import { indexL3 } from '@/lib/wagmi'
import { getTxUrl } from '@/lib/utils/explorer'

export function VaultDeposit() {
  const t = useTranslations('lending')
  const { address } = useAccount()
  const { showSuccess, showError } = useToast()
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
      const amt = amount || '0'
      showSuccess(`Deposited ${parseFloat(amt).toFixed(2)} USDC to vault`, txHash ? { url: getTxUrl(txHash, 'l3'), text: 'View tx' } : undefined)
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
      const errMsg = actionError.message || t('common.transaction_failed')
      setTxError(errMsg)
      showError(`Deposit failed: ${errMsg.slice(0, 80)}`)
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

  const balanceBig = (usdcBalance as bigint | undefined) ?? 0n
  const isInsufficient = Boolean(amount) && parsedAmount > balanceBig
  const isDisabled = !amount || parsedAmount === 0n || isProcessing || parsedAmount > balanceBig

  const submitStyle: CSSProperties = isDisabled
    ? {
        width: '100%',
        padding: '12px 16px',
        fontFamily: 'var(--apple-font-text)',
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: 'var(--apple-track-tight)',
        color: 'var(--apple-text-tertiary)',
        background: '#e5e5ea',
        border: 'none',
        borderRadius: 12,
        cursor: 'not-allowed',
        transition: 'background 180ms var(--apple-ease-default), opacity 180ms var(--apple-ease-default)',
      }
    : {
        width: '100%',
        padding: '12px 16px',
        fontFamily: 'var(--apple-font-text)',
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: 'var(--apple-track-tight)',
        color: '#fff',
        background: step === 'success' ? '#16a34a' : '#0071e3',
        border: 'none',
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'background 180ms var(--apple-ease-default), opacity 180ms var(--apple-ease-default)',
      }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between items-center mb-2">
          <label
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text-secondary)',
            }}
          >
            {t('vault_deposit.amount_label')}
          </label>
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text-tertiary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {t('vault_deposit.balance_label', { amount: parseFloat(formattedBalance).toFixed(2) })}
          </span>
        </div>
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="1"
            disabled={isProcessing}
            style={{
              width: '100%',
              padding: '12px 56px 12px 14px',
              fontFamily: 'var(--apple-font-text)',
              fontSize: 17,
              fontWeight: 500,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text)',
              background: 'var(--apple-panel)',
              border: '1px solid var(--apple-line)',
              borderRadius: 12,
              outline: 'none',
              transition: 'border-color 200ms var(--apple-ease-default), box-shadow 200ms var(--apple-ease-default)',
              fontVariantNumeric: 'tabular-nums',
              opacity: isProcessing ? 0.5 : 1,
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = '#0071e3'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.18)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'var(--apple-line)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          <button
            onClick={() => {
              const parsed = parseFloat(formattedBalance)
              setAmount((Math.floor(parsed * 100) / 100).toFixed(2))
            }}
            disabled={isProcessing}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              padding: '4px 10px',
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tight)',
              color: '#0071e3',
              background: 'rgba(0,113,227,0.08)',
              border: 'none',
              borderRadius: 6,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.5 : 1,
              transition: 'background 180ms var(--apple-ease-default)',
            }}
          >
            {t('actions.max')}
          </button>
        </div>
        {isInsufficient && (
          <p
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              letterSpacing: 'var(--apple-track-tight)',
              color: '#dc2626',
              margin: '6px 0 0 0',
            }}
          >
            {t('vault_deposit.insufficient_balance')}
          </p>
        )}
      </div>

      <button onClick={handleSubmit} disabled={isDisabled} style={submitStyle}>
        {buttonText}
      </button>

      {step === 'success' && txHash && (
        <a
          href={getTxUrl(txHash, 'l3')}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '6px 0',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            letterSpacing: 'var(--apple-track-tight)',
            color: '#0071e3',
            textDecoration: 'none',
          }}
        >
          {t('common.view_on_explorer')} ↗
        </a>
      )}

      {isProcessing && (
        <button
          onClick={handleCancel}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'center',
            padding: '8px 0',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text-secondary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {t('actions.cancel')}
        </button>
      )}

      {stuckWarning && (
        <div
          style={{
            padding: 12,
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 12,
            color: '#b45309',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            letterSpacing: 'var(--apple-track-tight)',
          }}
        >
          <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>{t('common.tx_stuck_title')}</p>
          <p style={{ fontSize: 12, color: '#92400e', marginTop: 4, marginBottom: 0 }}>
            {t('common.tx_stuck_description')}
          </p>
        </div>
      )}

      {txError && (
        <div
          style={{
            padding: 12,
            background: 'rgba(220, 38, 38, 0.06)',
            border: '1px solid rgba(220, 38, 38, 0.25)',
            borderRadius: 12,
            color: '#b91c1c',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            letterSpacing: 'var(--apple-track-tight)',
            wordBreak: 'break-word',
          }}
        >
          {txError.includes('User rejected') || txError.includes('denied')
            ? t('common.transaction_rejected')
            : txError.length > 100
            ? txError.slice(0, 100) + '...'
            : txError}
        </div>
      )}
    </div>
  )
}
