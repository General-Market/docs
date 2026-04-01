'use client'

import { useState } from 'react'
import { formatUnits, parseUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { cn } from '@/lib/utils/cn'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { indexL3 } from '@/lib/wagmi'
import { useVaultDeposit } from '@/hooks/vaults/useVaultDeposit'
import { useVaultRedeem } from '@/hooks/vaults/useVaultRedeem'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { SpringBackdrop, SpringModal, glass, ModalClose } from '@/components/ui/spring'
import type { VaultInfo } from '@/hooks/vaults/useVaults'

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

interface VaultActionsProps {
  vault: VaultInfo
  onClose: () => void
}

export function VaultActions({ vault, onClose }: VaultActionsProps) {
  const { address } = useAccount()
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [depositInput, setDepositInput] = useState('')
  const [withdrawInput, setWithdrawInput] = useState('')

  const { deposit, step: depositStep, isPending: depositPending, isConfirming: depositConfirming, error: depositError, reset: resetDeposit } = useVaultDeposit()
  const { redeem, step: redeemStep, isPending: redeemPending, isConfirming: redeemConfirming, error: redeemError, reset: resetRedeem } = useVaultRedeem()

  // User shares
  const { data: userShares } = useReadContract({
    address: vault.address,
    abi: VISION_VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address },
  })
  const shares = (userShares as bigint | undefined) ?? 0n
  const sharesFloat = parseFloat(formatUnits(shares, 18))
  const userValue = vault.totalSupply > 0n && shares > 0n
    ? (Number(shares) / Number(vault.totalSupply)) * parseFloat(formatUnits(vault.totalAssets, 18))
    : 0

  const perfPercent = (vault.performanceSinceInception * 100).toFixed(2)
  const isPositive = vault.performanceSinceInception >= 0
  const feePercent = Number(vault.performanceFeeRate) / 1e16

  const handleDeposit = () => {
    const amount = parseUnits(depositInput || '0', 18)
    if (amount <= 0n) return
    deposit(vault.address, amount)
  }

  const handleWithdraw = () => {
    const shareAmount = parseUnits(withdrawInput || '0', 18)
    if (shareAmount <= 0n) return
    redeem(vault.address, shareAmount)
  }

  const depositBusy = depositStep === 'approving' || depositStep === 'depositing'
  const redeemBusy = redeemStep === 'requesting'

  return (
    <SpringBackdrop className={glass.backdrop} onClick={onClose}>
      <SpringModal
        className={`${glass.modal} max-w-lg w-full relative`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pb-6">
          <ModalClose onClick={onClose} className="absolute top-4 right-4" />

          {/* Vault header */}
          <div className="pt-8 mb-6">
            <h2 className="text-title font-bold text-black">{vault.name}</h2>
            <p className="text-xs text-text-muted font-mono mt-0.5">
              Manager: {truncateAddress(vault.manager)}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatBox label="TVL" value={`$${vault.tvlFormatted}`} />
            <StatBox label="NAV / Share" value={`$${vault.navPerShare.toFixed(4)}`} />
            <StatBox
              label="Performance"
              value={`${isPositive ? '+' : ''}${perfPercent}%`}
              valueColor={isPositive ? 'text-color-up' : 'text-color-down'}
            />
            <StatBox label="Fee" value={`${feePercent.toFixed(0)}% perf`} />
          </div>

          {/* User position */}
          {shares > 0n && (
            <div className="border border-border-light rounded-md p-4 mb-6">
              <p className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">Your Position</p>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-text-secondary">Value</span>
                <span className="font-mono tabular-nums text-text-primary font-semibold">
                  ${userValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Shares</span>
                <span className="font-mono tabular-nums text-text-secondary">
                  {sharesFloat.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-border-light mb-4">
            <button
              onClick={() => { setTab('deposit'); resetDeposit(); resetRedeem() }}
              className={cn(
                'flex-1 py-2 text-sm font-semibold transition-colors',
                tab === 'deposit'
                  ? 'text-text-primary border-b-2 border-brand'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              Deposit
            </button>
            <button
              onClick={() => { setTab('withdraw'); resetDeposit(); resetRedeem() }}
              className={cn(
                'flex-1 py-2 text-sm font-semibold transition-colors',
                tab === 'withdraw'
                  ? 'text-text-primary border-b-2 border-brand'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              Withdraw
            </button>
          </div>

          {/* Deposit form */}
          {tab === 'deposit' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted block mb-1">Amount (USDC)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={depositInput}
                  onChange={(e) => setDepositInput(e.target.value)}
                  className="w-full px-3 py-2 border border-border-light rounded-md bg-card text-text-primary
                             font-mono tabular-nums text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <WalletActionButton
                onClick={handleDeposit}
                disabled={depositBusy || depositConfirming || !depositInput}
                className="w-full py-2.5 bg-brand text-white text-sm font-bold rounded-md
                           hover:bg-brand-dark transition-colors disabled:opacity-50"
              >
                {depositStep === 'approving' ? 'Approving...'
                  : depositStep === 'depositing' ? 'Depositing...'
                  : depositConfirming ? 'Confirming...'
                  : depositStep === 'done' ? 'Deposit requested'
                  : 'Deposit'}
              </WalletActionButton>
              {depositError && (
                <p className="text-xs text-color-down">{depositError}</p>
              )}
              {depositStep === 'done' && (
                <p className="text-xs text-color-up">Deposit request submitted. Shares will be claimable after reconciliation.</p>
              )}
            </div>
          )}

          {/* Withdraw form */}
          {tab === 'withdraw' && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-text-muted">Shares to redeem</label>
                  {shares > 0n && (
                    <button
                      onClick={() => setWithdrawInput(formatUnits(shares, 18))}
                      className="text-xs text-brand hover:text-brand-dark transition-colors"
                    >
                      Max
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="0.00"
                  value={withdrawInput}
                  onChange={(e) => setWithdrawInput(e.target.value)}
                  className="w-full px-3 py-2 border border-border-light rounded-md bg-card text-text-primary
                             font-mono tabular-nums text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <WalletActionButton
                onClick={handleWithdraw}
                disabled={redeemBusy || redeemConfirming || !withdrawInput}
                className="w-full py-2.5 border-2 border-zinc-900 text-text-primary text-sm font-bold rounded-md
                           hover:bg-zinc-900 hover:text-white transition-colors disabled:opacity-50"
              >
                {redeemStep === 'requesting' ? 'Requesting...'
                  : redeemConfirming ? 'Confirming...'
                  : redeemStep === 'done' ? 'Redeem requested'
                  : 'Request Redeem'}
              </WalletActionButton>
              {redeemError && (
                <p className="text-xs text-color-down">{redeemError}</p>
              )}
              {redeemStep === 'done' && (
                <p className="text-xs text-color-up">Redeem request submitted. USDC will be claimable after reconciliation.</p>
              )}
            </div>
          )}
        </div>
      </SpringModal>
    </SpringBackdrop>
  )
}

function StatBox({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="border border-border-light rounded-md px-3 py-2">
      <p className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <p className={cn('text-sm font-bold font-mono tabular-nums', valueColor || 'text-text-primary')}>{value}</p>
    </div>
  )
}
