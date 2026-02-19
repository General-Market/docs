'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { useMetaMorphoVault } from '@/hooks/useMetaMorphoVault'
import { useVaultDeposit } from '@/hooks/useVaultDeposit'

/**
 * VaultPosition component (AC7)
 *
 * Shows user's vault shares and current value.
 * Allows withdrawing from the vault.
 */
export function VaultPosition() {
  useAccount() // Required for wallet connection context
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

  if (isLoading) {
    return null
  }

  if (!userPosition || userPosition.shares === 0n) {
    return null
  }

  // Use vault decimals for shares (typically 18 for ERC4626), default to 18
  const sharesDecimals = vaultInfo?.decimals ?? 18
  const sharesFormatted = formatUnits(userPosition.shares, sharesDecimals)
  // USDC value uses 6 decimals
  const valueFormatted = formatUnits(userPosition.value, 6)

  const isProcessing = isPending || isConfirming

  return (
    <div className="bg-terminal-dark border border-white/10 rounded-lg p-6">
      <h2 className="text-lg font-bold text-white mb-4">Your Vault Position</h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-black/30 rounded-lg p-4">
          <p className="text-white/60 text-xs mb-1">Vault Shares</p>
          <p className="text-white font-bold text-xl font-mono">
            {parseFloat(sharesFormatted).toFixed(4)}
          </p>
          <p className="text-white/40 text-xs">{vaultInfo?.symbol ?? 'shares'}</p>
        </div>

        <div className="bg-black/30 rounded-lg p-4">
          <p className="text-white/60 text-xs mb-1">Current Value</p>
          <p className="text-green-400 font-bold text-xl font-mono">
            ${parseFloat(valueFormatted).toFixed(2)}
          </p>
          <p className="text-white/40 text-xs">USDC</p>
        </div>
      </div>

      <button
        onClick={handleWithdraw}
        disabled={isProcessing || userPosition.shares === 0n}
        className={`w-full py-3 font-bold rounded-lg transition-colors ${
          isSuccess
            ? 'bg-green-500 text-white'
            : 'bg-white/10 text-white hover:bg-white/20 disabled:bg-white/5 disabled:text-white/30 disabled:cursor-not-allowed'
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
        <div className="mt-4 bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
          {txError.includes('User rejected') || txError.includes('denied')
            ? 'Transaction rejected'
            : txError.length > 100
            ? txError.slice(0, 100) + '...'
            : txError}
        </div>
      )}
    </div>
  )
}
