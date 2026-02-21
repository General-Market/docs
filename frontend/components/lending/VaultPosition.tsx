'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { useMetaMorphoVault } from '@/hooks/useMetaMorphoVault'
import { useVaultDeposit } from '@/hooks/useVaultDeposit'

export function VaultPosition() {
  useAccount()
  const [txError, setTxError] = useState<string | null>(null)

  const { userPosition, vaultInfo, refetch: refetchVault, isLoading } = useMetaMorphoVault()
  const {
    redeem,
    isPending,
    isConfirming,
    isSuccess,
    error: actionError,
    reset,
  } = useVaultDeposit()

  const successHandled = useRef(false)

  useEffect(() => {
    if (isSuccess && !successHandled.current) {
      successHandled.current = true
      refetchVault()
      setTimeout(() => {
        reset()
        successHandled.current = false
      }, 2000)
    }
  }, [isSuccess, refetchVault, reset])

  useEffect(() => {
    if (actionError) {
      setTxError(actionError.message || 'Withdrawal failed')
      reset()
    }
  }, [actionError, reset])

  const handleWithdraw = useCallback(() => {
    if (!userPosition || userPosition.shares === 0n) return
    successHandled.current = false
    setTxError(null)
    redeem(userPosition.shares)
  }, [userPosition, redeem])

  if (isLoading) return null
  if (!userPosition || userPosition.shares === 0n) return null

  const sharesDecimals = vaultInfo?.decimals ?? 18
  const sharesFormatted = formatUnits(userPosition.shares, sharesDecimals)
  const valueFormatted = formatUnits(userPosition.value, 6)

  const isProcessing = isPending || isConfirming

  return (
    <div>
      <div className="section-bar">
        <div>
          <div className="section-bar-title">Position</div>
          <div className="section-bar-value">Your Vault Deposits</div>
        </div>
      </div>

      <div className="border border-border-light border-t-0">
        {/* Position stats */}
        <div className="grid grid-cols-2 border-b border-border-light">
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">Vault Shares</p>
            <p className="text-[20px] font-extrabold font-mono tabular-nums text-black">
              {parseFloat(sharesFormatted).toFixed(4)}
            </p>
            <p className="text-[11px] text-text-muted">{vaultInfo?.symbol ?? 'shares'}</p>
          </div>
          <div className="px-5 py-4 border-l border-border-light">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">Current Value</p>
            <p className="text-[20px] font-extrabold font-mono tabular-nums text-color-up">
              ${parseFloat(valueFormatted).toFixed(2)}
            </p>
            <p className="text-[11px] text-text-muted">USDC</p>
          </div>
        </div>

        {/* Withdraw button */}
        <div className="px-5 py-4">
          <button
            onClick={handleWithdraw}
            disabled={isProcessing || userPosition.shares === 0n}
            className={`w-full py-2.5 font-bold text-[13px] uppercase tracking-[0.06em] transition-colors ${
              isSuccess
                ? 'bg-color-up text-white'
                : 'bg-muted text-text-primary hover:bg-zinc-200 disabled:bg-muted disabled:text-text-muted disabled:cursor-not-allowed'
            }`}
          >
            {isPending
              ? 'Confirm in wallet...'
              : isConfirming
              ? 'Withdrawing...'
              : isSuccess
              ? 'Withdrawn!'
              : 'Withdraw All'}
          </button>

          {txError && (
            <div className="mt-3 bg-color-down/10 border border-color-down/30 p-3 text-color-down text-[12px]">
              {txError.includes('User rejected') || txError.includes('denied')
                ? 'Transaction rejected'
                : txError.length > 100
                ? txError.slice(0, 100) + '...'
                : txError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
