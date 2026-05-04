'use client'

/**
 * VaultActionsPanel — inline deposit/withdraw form for a single vault.
 *
 * The Apple-shell vault page renders this as a card panel, not as a modal.
 * The legacy `VaultActions` component is a 1100-line modal with a sidebar of
 * other vaults; here we already know which vault the user is on. We strip the
 * modal chrome, keep the same hooks (`useVaultDeposit`, `useVaultRedeem`),
 * and render two tabs against tinted off-white surfaces.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { formatUnits, parseUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { useVaultDeposit } from '@/hooks/vaults/useVaultDeposit'
import { useVaultRedeem } from '@/hooks/vaults/useVaultRedeem'
import { useSSEUserVaultPosition } from '@/hooks/useSSE'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { indexL3 } from '@/lib/wagmi'
import { useDeployment } from '@/hooks/useDeployment'

const USDC_BALANCE_ABI = [{
  inputs: [{ name: 'account', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
}] as const

interface VaultActionsPanelProps {
  vaultAddress: `0x${string}`
  performanceFeeRate?: bigint
  totalAssets?: bigint
  totalSupply?: bigint
}

export function VaultActionsPanel({
  vaultAddress,
  performanceFeeRate = 0n,
  totalAssets = 0n,
  totalSupply = 0n,
}: VaultActionsPanelProps) {
  const t = useTranslations('vision')
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [depositInput, setDepositInput] = useState('')
  const [withdrawInput, setWithdrawInput] = useState('')

  const { address: userAddress } = useAccount()
  const { getAddress } = useDeployment()
  const usdcAddress = getAddress('L3_WUSDC')

  const {
    deposit, step: depositStep, isConfirming: depositConfirming,
    error: depositError, reset: resetDeposit, justDepositedAmount,
  } = useVaultDeposit()

  const {
    redeem, step: redeemStep, isConfirming: redeemConfirming,
    error: redeemError, reset: resetRedeem,
  } = useVaultRedeem()

  // ---- balances --------------------------------------------------------
  const { data: usdcBalanceRaw, refetch: refetchUsdcBalance } = useReadContract({
    address: usdcAddress,
    abi: USDC_BALANCE_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    chainId: indexL3.id,
    query: {
      enabled: !!userAddress && usdcAddress !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 10_000,
    },
  })
  const usdcBalance = (usdcBalanceRaw as bigint | undefined) ?? 0n
  const usdcBalanceFloat = parseFloat(formatUnits(usdcBalance, 18))

  const { data: onChainShares, refetch: refetchShares } = useReadContract({
    address: vaultAddress,
    abi: VISION_VAULT_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!userAddress, refetchInterval: 8000 },
  })

  const { data: onChainPending, refetch: refetchPending } = useReadContract({
    address: vaultAddress,
    abi: VISION_VAULT_ABI,
    functionName: 'pendingDepositRequest',
    args: userAddress ? [0n, userAddress] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!userAddress, refetchInterval: 8000 },
  })

  const ssePosition = useSSEUserVaultPosition(vaultAddress)
  const sseShares = ssePosition
    ? (() => { try { return BigInt(ssePosition.shares) } catch { return 0n } })()
    : 0n
  const ssePending = ssePosition
    ? (() => { try { return BigInt(ssePosition.pending_deposit) } catch { return 0n } })()
    : 0n

  const resolvedShares = (onChainShares as bigint | undefined) ?? sseShares
  const resolvedPending = (onChainPending as bigint | undefined) ?? ssePending

  // Burst-refetch after a deposit so the UI catches up with reality fast.
  useEffect(() => {
    if (depositStep !== 'done') return
    refetchShares()
    refetchPending()
    refetchUsdcBalance()
    const t1 = setTimeout(() => { refetchShares(); refetchPending(); refetchUsdcBalance() }, 1200)
    const t2 = setTimeout(() => { refetchShares(); refetchPending(); refetchUsdcBalance() }, 3500)
    const t3 = setTimeout(() => { refetchShares(); refetchPending(); refetchUsdcBalance() }, 7000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [depositStep, refetchShares, refetchPending, refetchUsdcBalance])

  useEffect(() => {
    if (depositStep === 'done') setDepositInput('')
  }, [depositStep])

  const isOptimistic =
    justDepositedAmount > 0n && resolvedShares === 0n && resolvedPending === 0n
  const shares = resolvedShares
  const pendingAssets = isOptimistic ? justDepositedAmount : resolvedPending

  const sharesFloat = parseFloat(formatUnits(shares, 18))
  const pendingFloat = parseFloat(formatUnits(pendingAssets, 18))

  // userValue = pro-rata claim on totalAssets given current share supply.
  const userValue =
    totalSupply > 0n && shares > 0n
      ? (Number(shares) / Number(totalSupply)) * parseFloat(formatUnits(totalAssets, 18))
      : 0
  const userPnl = shares > 0n ? userValue - sharesFloat : 0
  const hasPosition = shares > 0n || pendingAssets > 0n
  const feePercent = Number(performanceFeeRate) / 1e16

  const depositBusy =
    depositStep === 'preparing' ||
    depositStep === 'approving' ||
    depositStep === 'depositing' ||
    depositStep === 'claiming'
  const redeemBusy = redeemStep === 'requesting'

  const handleDeposit = () => {
    const amount = parseUnits(depositInput || '0', 18)
    if (amount <= 0n) return
    deposit(vaultAddress, amount)
  }
  const handleWithdraw = () => {
    const sh = parseUnits(withdrawInput || '0', 18)
    if (sh <= 0n) return
    redeem(vaultAddress, sh)
  }

  const depositLabel =
    depositStep === 'preparing' ? t('vaults.preparing')
      : depositStep === 'approving' ? t('vaults.approving')
      : depositStep === 'depositing' ? t('vaults.depositing')
      : depositStep === 'claiming' ? t('vaults.claiming')
      : depositConfirming ? t('vaults.confirming')
      : depositStep === 'done' ? t('vaults.deposited')
      : hasPosition ? t('vaults.deposit_usdc') : t('vaults.deposit')

  const withdrawLabel =
    redeemStep === 'requesting' ? t('vaults.requesting')
      : redeemConfirming ? t('vaults.confirming')
      : redeemStep === 'done' ? t('vaults.redeem_requested')
      : t('vaults.withdraw')

  return (
    <section
      aria-label="Deposit and withdraw"
      style={{
        background: 'var(--apple-panel,#ffffff)',
        borderRadius: 'var(--apple-r-card,28px)',
        border: '1px solid var(--apple-line,rgba(0,0,0,0.08))',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--apple-font-display)',
          fontSize: 'var(--apple-fs-21,21px)',
          fontWeight: 600,
          letterSpacing: 'var(--apple-track-tighter)',
          color: 'var(--apple-text)',
          margin: 0,
        }}
      >
        Position
      </h2>

      {/* Tabs */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          padding: 3,
          background: 'var(--apple-surface)',
          borderRadius: 'var(--apple-r-md,12px)',
          gap: 2,
        }}
      >
        <TabButton active={tab === 'deposit'} onClick={() => { setTab('deposit'); resetRedeem?.() }}>
          Deposit
        </TabButton>
        <TabButton active={tab === 'withdraw'} onClick={() => { setTab('withdraw'); resetDeposit?.() }}>
          Withdraw
        </TabButton>
      </div>

      {/* Input */}
      {tab === 'deposit' ? (
        <FieldShell
          label="Amount"
          right={
            userAddress ? (
              <button
                type="button"
                onClick={() => setDepositInput(formatUnits(usdcBalance, 18))}
                disabled={usdcBalance === 0n}
                style={maxButtonStyle}
              >
                Max
              </button>
            ) : null
          }
          footer={
            userAddress ? (
              <span style={subtleStyle}>
                Balance {usdcBalanceFloat.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} USDC
              </span>
            ) : (
              <span style={subtleStyle}>Connect a wallet to see your USDC balance.</span>
            )
          }
        >
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={depositInput}
            onChange={(e) => setDepositInput(e.target.value)}
            data-onboarding-target="vault-input"
            style={inputStyle}
          />
          <span style={suffixStyle}>USDC</span>
        </FieldShell>
      ) : (
        <FieldShell
          label="Shares"
          right={
            shares > 0n ? (
              <button
                type="button"
                onClick={() => setWithdrawInput(formatUnits(shares, 18))}
                style={maxButtonStyle}
              >
                Max
              </button>
            ) : null
          }
          footer={
            <span style={subtleStyle}>
              Held{' '}
              {sharesFloat.toLocaleString(undefined, {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4,
              })}{' '}
              shares
            </span>
          }
        >
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.0001"
            placeholder="0.00"
            value={withdrawInput}
            onChange={(e) => setWithdrawInput(e.target.value)}
            style={inputStyle}
          />
          <span style={suffixStyle}>Shares</span>
        </FieldShell>
      )}

      {/* Errors */}
      {tab === 'deposit' && depositError ? (
        <p style={errorStyle}>{depositError}</p>
      ) : null}
      {tab === 'withdraw' && redeemError ? (
        <p style={errorStyle}>{redeemError}</p>
      ) : null}

      {/* Action */}
      <WalletActionButton
        onClick={() => (tab === 'deposit' ? handleDeposit() : handleWithdraw())}
        disabled={
          tab === 'deposit'
            ? depositBusy || depositConfirming || !depositInput
            : redeemBusy || redeemConfirming || !withdrawInput
        }
        className="vault-action-button"
      >
        {tab === 'deposit' ? depositLabel : withdrawLabel}
      </WalletActionButton>

      <p style={{ ...subtleStyle, textAlign: 'center', margin: 0 }}>
        No lock-up. {feePercent.toFixed(0)}% performance fee.
      </p>

      {/* Position summary */}
      {hasPosition ? (
        <div
          style={{
            marginTop: 4,
            padding: '14px 16px',
            background: 'var(--apple-surface)',
            borderRadius: 'var(--apple-r-md,12px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={positionHeaderStyle}>
            <span>Your position</span>
            {isOptimistic ? <span style={{ color: 'rgb(52,199,89)' }}>awaiting confirmation…</span> : null}
          </div>

          {shares > 0n ? (
            <>
              <PositionRow
                label="Shares"
                value={sharesFloat.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              />
              <PositionRow label="Value" value={`$${userValue.toFixed(2)}`} />
              <PositionRow
                label="P&L"
                value={`${userPnl >= 0 ? '+' : ''}$${userPnl.toFixed(2)}`}
                tone={userPnl >= 0 ? 'up' : 'down'}
              />
            </>
          ) : null}

          {pendingAssets > 0n ? (
            <PositionRow
              label={isOptimistic ? 'Just deposited' : 'Pending deposit'}
              value={`$${pendingFloat.toFixed(2)}`}
              tone="up"
            />
          ) : null}
        </div>
      ) : null}

      <style jsx>{`
        .vault-action-button {
          width: 100%;
          padding: 12px 18px;
          background: var(--apple-accent, #0071e3);
          color: #fff;
          font-family: var(--apple-font-text);
          font-size: 17px;
          font-weight: 500;
          letter-spacing: var(--apple-track-tight);
          border: none;
          border-radius: var(--apple-r-pill, 980px);
          cursor: pointer;
          transition: background-color 0.15s ease;
        }
        .vault-action-button:hover:not(:disabled) {
          background: var(--apple-accent-hover, #0066cc);
        }
        .vault-action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </section>
  )
}

// ── helpers ───────────────────────────────────────────────

function TabButton({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 12px',
        background: active ? 'var(--apple-panel,#ffffff)' : 'transparent',
        color: active ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
        fontFamily: 'var(--apple-font-text)',
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: 'var(--apple-track-tight)',
        border: 'none',
        borderRadius: 9,
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
      }}
    >
      {children}
    </button>
  )
}

function FieldShell({
  label, children, right, footer,
}: {
  label: string
  children: ReactNode
  right?: ReactNode
  footer?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-loose)',
            textTransform: 'uppercase',
            color: 'var(--apple-text-tertiary)',
          }}
        >
          {label}
        </span>
        {right}
      </div>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          background: 'var(--apple-surface)',
          borderRadius: 'var(--apple-r-md,12px)',
          padding: '0 14px',
          border: '1px solid transparent',
        }}
      >
        {children}
      </div>
      {footer}
    </div>
  )
}

function PositionRow({
  label, value, tone,
}: {
  label: string
  value: string
  tone?: 'up' | 'down'
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 13,
          color: 'var(--apple-text-secondary)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 14,
          fontWeight: 600,
          color:
            tone === 'up' ? 'rgb(52,199,89)'
            : tone === 'down' ? 'rgb(255,59,48)'
            : 'var(--apple-text)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  padding: '14px 0',
  fontFamily: 'var(--apple-font-text)',
  fontVariantNumeric: 'tabular-nums',
  fontSize: 18,
  fontWeight: 500,
  color: 'var(--apple-text)',
  letterSpacing: 'var(--apple-track-tight)',
}

const suffixStyle: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--apple-text-tertiary)',
  letterSpacing: 'var(--apple-track-loose)',
  textTransform: 'uppercase',
}

const maxButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--apple-accent,#0071e3)',
  fontFamily: 'var(--apple-font-text)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-loose)',
  textTransform: 'uppercase',
  cursor: 'pointer',
  padding: 0,
}

const subtleStyle: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 12,
  color: 'var(--apple-text-tertiary)',
  letterSpacing: 'var(--apple-track-mid)',
}

const errorStyle: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 13,
  color: 'rgb(255,59,48)',
  margin: 0,
  padding: '10px 12px',
  background: 'rgba(255,59,48,0.06)',
  borderRadius: 'var(--apple-r-sm,8px)',
}

const positionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  fontFamily: 'var(--apple-font-text)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-loose)',
  textTransform: 'uppercase',
  color: 'var(--apple-text-tertiary)',
}
