'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { formatUnits } from 'viem'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useMetaMorphoVault } from '@/hooks/useMetaMorphoVault'
import { useMorphoMarkets } from '@/hooks/useMorphoMarkets'
import { useMorphoPosition } from '@/hooks/useMorphoPosition'
import { VaultDeposit } from '@/components/lending/VaultDeposit'
import { VaultPosition } from '@/components/lending/VaultPosition'
import { BorrowUsdc } from '@/components/lending/BorrowUsdc'
import { RepayDebt } from '@/components/lending/RepayDebt'
import { BRIDGED_ITP_ABI } from '@/lib/contracts/index-protocol-abi'

const LendingErrorFallback = (
  <div className="bg-surface-down border border-color-down/30 rounded-xl p-6 text-center">
    <h3 className="text-color-down font-bold mb-2">Something went wrong</h3>
    <p className="text-text-muted text-sm">Please refresh the page.</p>
  </div>
)

interface VaultModalProps {
  onClose: () => void
  inline?: boolean
}

type ActiveAction = null | 'deposit' | 'withdraw' | 'borrow' | 'repay'

export function VaultModal({ onClose, inline }: VaultModalProps) {
  const { isConnected } = useAccount()
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)

  const toggleAction = (action: ActiveAction) => {
    setActiveAction(prev => prev === action ? null : action)
  }

  const header = (
    <div className="pt-10 mb-6">
      <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-1.5">Morpho Vaults</p>
      <h2 className="text-[32px] font-black tracking-[-0.02em] text-black leading-[1.1]">Lend</h2>
      <p className="text-[14px] text-text-secondary mt-1.5">Deposit USDC to earn yield or borrow against your ITP positions.</p>
    </div>
  )

  const lendContent = (
    <>
      {header}
      {!isConnected ? (
        <LendSkeleton />
      ) : (
        <ErrorBoundary fallback={LendingErrorFallback}>
          <LendDashboard activeAction={activeAction} toggleAction={toggleAction} />
        </ErrorBoundary>
      )}
    </>
  )

  if (inline) {
    return <div className="pb-10">{lendContent}</div>
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white border border-border-light rounded-md max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-card relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pb-6">
          <button onClick={onClose} className="absolute top-4 right-4 text-text-muted hover:text-text-primary text-2xl">&times;</button>
          {lendContent}
        </div>
      </div>
    </div>
  )
}

/* ── Dashboard Content ── */
function LendDashboard({ activeAction, toggleAction }: { activeAction: ActiveAction; toggleAction: (a: ActiveAction) => void }) {
  const { vaultInfo, userPosition } = useMetaMorphoVault()
  const { markets } = useMorphoMarkets()
  const { position } = useMorphoPosition()

  const market = markets[0]
  const supplyApy = vaultInfo?.apy ?? 0
  const borrowApy = market?.borrowApy ?? 0
  const utilization = vaultInfo?.utilization ?? 0

  // Format vault TVL
  const vaultTvl = vaultInfo?.totalAssets
    ? `$${parseFloat(formatUnits(vaultInfo.totalAssets, 6)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : '--'

  // User supply data
  const userDeposits = userPosition?.value
    ? `$${parseFloat(formatUnits(userPosition.value, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00'
  // Accrued interest estimate (value - original deposit, simplified)
  const accruedInterest = userPosition?.value && userPosition.value > 0n
    ? `+$${(parseFloat(formatUnits(userPosition.value, 6)) * (supplyApy / 100)).toFixed(2)}`
    : '$0.00'

  // User borrow data
  const collateralValue = position?.collateralAmount
    ? `$${(parseFloat(formatUnits(position.collateralAmount, 18)) * (market ? Number(market.navPrice) / 1e36 : 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00'
  const outstandingDebt = position?.debtAmount
    ? `$${parseFloat(formatUnits(position.debtAmount, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00'
  const maxBorrow = position?.maxBorrow
    ? `$${parseFloat(formatUnits(position.maxBorrow, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00'
  const lltvPercent = market?.lltvPercent ?? 70

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-border-light">
        <StatCell label="Vault TVL" value={vaultTvl} />
        <StatCell label="Supply APY" value={`${supplyApy.toFixed(2)}%`} color="text-color-up" />
        <StatCell label="Borrow APY" value={`${borrowApy.toFixed(2)}%`} />
        <StatCell label="Utilization" value={`${utilization.toFixed(1)}%`} />
      </div>

      {/* Two-column: Supply | Borrow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* LEFT — Supply / USDC Vault */}
        <div className="border border-border-light">
          <div className="bg-black text-white px-5 py-3 text-[12px] font-bold uppercase tracking-[0.08em]">
            Supply — USDC Vault
          </div>
          <div className="p-5 space-y-4">
            <InfoRow label="Your Deposits" value={userDeposits} />
            <InfoRow label="Accrued Interest" value={accruedInterest} valueColor="text-color-up" />
            <InfoRow label="Current APY" value={`${supplyApy.toFixed(2)}%`} mono />

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => toggleAction('deposit')}
                className={`py-2.5 font-bold text-[13px] uppercase tracking-[0.06em] transition-colors ${
                  activeAction === 'deposit'
                    ? 'bg-zinc-700 text-white'
                    : 'bg-zinc-900 text-white hover:bg-zinc-800'
                }`}
              >
                Deposit
              </button>
              <button
                onClick={() => toggleAction('withdraw')}
                className={`py-2.5 font-bold text-[13px] uppercase tracking-[0.06em] border transition-colors ${
                  activeAction === 'withdraw'
                    ? 'bg-zinc-100 border-zinc-900 text-zinc-900'
                    : 'border-border-medium text-text-primary hover:bg-muted'
                }`}
              >
                Withdraw
              </button>
            </div>

            {/* Inline action forms */}
            {activeAction === 'deposit' && (
              <div className="border-t border-border-light pt-4">
                <VaultDeposit />
              </div>
            )}
            {activeAction === 'withdraw' && (
              <div className="border-t border-border-light pt-4">
                <VaultPosition />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Borrow / Against ITP */}
        <div className="border border-border-light">
          <div className="bg-black text-white px-5 py-3 text-[12px] font-bold uppercase tracking-[0.08em]">
            Borrow — Against ITP
          </div>
          <div className="p-5 space-y-4">
            <InfoRow label="Collateral (ITP value)" value={collateralValue} />
            <InfoRow label="Outstanding Debt" value={outstandingDebt} />
            <InfoRow label={`Max Borrow (${lltvPercent.toFixed(0)}% LTV)`} value={maxBorrow} />

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => toggleAction('borrow')}
                className={`py-2.5 font-bold text-[13px] uppercase tracking-[0.06em] transition-colors ${
                  activeAction === 'borrow'
                    ? 'bg-zinc-700 text-white'
                    : 'bg-zinc-900 text-white hover:bg-zinc-800'
                }`}
              >
                Borrow USDC
              </button>
              <button
                onClick={() => toggleAction('repay')}
                className={`py-2.5 font-bold text-[13px] uppercase tracking-[0.06em] border transition-colors ${
                  activeAction === 'repay'
                    ? 'bg-zinc-100 border-zinc-900 text-zinc-900'
                    : 'border-border-medium text-text-primary hover:bg-muted'
                }`}
              >
                Repay
              </button>
            </div>

            {/* Inline action forms */}
            {activeAction === 'borrow' && (
              <div className="border-t border-border-light pt-4">
                <BorrowUsdc onSuccess={() => toggleAction(null)} />
              </div>
            )}
            {activeAction === 'repay' && (
              <div className="border-t border-border-light pt-4">
                <RepayDebt onSuccess={() => toggleAction(null)} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Markets Table */}
      <MarketsTableInline />
    </div>
  )
}

/* ── Stat Cell ── */
function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="px-5 py-4 border-b lg:border-b-0 border-r border-border-light last:border-r-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">{label}</p>
      <p className={`text-[22px] font-extrabold font-mono tabular-nums ${color || 'text-black'}`}>
        {value}
      </p>
    </div>
  )
}

/* ── Info Row ── */
function InfoRow({ label, value, valueColor, mono }: { label: string; value: string; valueColor?: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border-light last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className={`text-sm font-semibold ${mono ? 'font-mono tabular-nums' : ''} ${valueColor || 'text-text-primary'}`}>
        {value}
      </span>
    </div>
  )
}

/* ── Inline Markets Table ── */
function MarketsTableInline() {
  const { markets, isLoading } = useMorphoMarkets()
  const publicClient = usePublicClient()
  const [itpNames, setItpNames] = useState<Map<string, string>>(new Map())
  const publicClientRef = useRef(publicClient)

  useEffect(() => { publicClientRef.current = publicClient }, [publicClient])

  // Fetch ITP names for all collateral tokens
  const fetchNames = useCallback(async () => {
    const client = publicClientRef.current
    if (!client || markets.length === 0) return
    const nameMap = new Map<string, string>()
    for (const m of markets) {
      const addr = m.params.collateralToken
      if (nameMap.has(addr)) continue
      try {
        const name = await client.readContract({
          address: addr,
          abi: BRIDGED_ITP_ABI,
          functionName: 'name',
        }) as string
        nameMap.set(addr, name)
      } catch {
        nameMap.set(addr, 'ITP')
      }
    }
    setItpNames(nameMap)
  }, [markets])

  useEffect(() => { fetchNames() }, [fetchNames])

  // Static demo rows for the mockup look (markets from chain + placeholder extras)
  const rows = markets.length > 0
    ? markets.map(m => ({
        market: `USDC / ${itpNames.get(m.params.collateralToken) || 'ITP'}`,
        collateral: 'ITP',
        supplyApy: m.borrowApy > 0 ? (m.borrowApy * (m.utilization / 100)).toFixed(2) : '--',
        borrowApy: m.borrowApy.toFixed(2),
        tvl: m.totalBorrowed > 0n
          ? `$${(parseFloat(formatUnits(m.totalBorrowed, 6)) / (m.utilization / 100 || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
          : '--',
        utilization: `${m.utilization.toFixed(1)}%`,
        lltv: `${m.lltvPercent.toFixed(0)}%`,
      }))
    : []

  return (
    <div>
      <div className="bg-black text-white px-5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-0.5">Morpho Markets</p>
        <p className="text-[15px] font-bold">Available Lending Markets</p>
      </div>

      <div className="border border-border-light border-t-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted border-b border-border-light">
              <th className="text-left px-5 py-3">Market</th>
              <th className="text-left px-5 py-3">Collateral</th>
              <th className="text-right px-5 py-3">Supply APY</th>
              <th className="text-right px-5 py-3">Borrow APY</th>
              <th className="text-right px-5 py-3">TVL</th>
              <th className="text-right px-5 py-3">Utilization</th>
              <th className="text-right px-5 py-3">LLTV</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-text-muted">Loading markets...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-text-muted">No markets available</td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-b border-border-light last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-semibold text-text-primary">{row.market}</td>
                  <td className="px-5 py-3 text-text-secondary">{row.collateral}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-color-up">{row.supplyApy}%</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-text-primary">{row.borrowApy}%</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-text-primary">{row.tvl}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-text-primary">{row.utilization}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-text-primary">{row.lltv}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Skeleton ── */
function Bone({ w = 'w-20', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-border-light rounded animate-pulse`} />
}

function LendSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-border-light">
        {['Vault TVL', 'Supply APY', 'Borrow APY', 'Utilization'].map((label, idx) => (
          <div key={label} className="px-5 py-4 border-b lg:border-b-0 border-r border-border-light last:border-r-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">{label}</p>
            <Bone w={idx === 0 ? 'w-20' : 'w-16'} h="h-7" />
          </div>
        ))}
      </div>

      {/* Two-column panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Supply */}
        <div className="border border-border-light">
          <div className="bg-black text-white px-5 py-3 text-[12px] font-bold uppercase tracking-[0.08em]">
            Supply — USDC Vault
          </div>
          <div className="p-5 space-y-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-border-light">
                <Bone w="w-28" h="h-4" />
                <Bone w="w-20" h="h-4" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="h-[42px] bg-zinc-900/30 animate-pulse" />
              <div className="h-[42px] bg-muted border border-border-medium animate-pulse" />
            </div>
          </div>
        </div>
        {/* Borrow */}
        <div className="border border-border-light">
          <div className="bg-black text-white px-5 py-3 text-[12px] font-bold uppercase tracking-[0.08em]">
            Borrow — Against ITP
          </div>
          <div className="p-5 space-y-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-border-light">
                <Bone w="w-28" h="h-4" />
                <Bone w="w-20" h="h-4" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="h-[42px] bg-zinc-900/30 animate-pulse" />
              <div className="h-[42px] bg-muted border border-border-medium animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Markets table skeleton */}
      <div>
        <div className="bg-black text-white px-5 py-3">
          <Bone w="w-28" h="h-3" />
          <div className="mt-1"><Bone w="w-44" h="h-5" /></div>
        </div>
        <div className="border border-border-light border-t-0 p-5 space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex justify-between">
              <Bone w="w-24" h="h-4" />
              <Bone w="w-16" h="h-4" />
              <Bone w="w-12" h="h-4" />
              <Bone w="w-12" h="h-4" />
              <Bone w="w-16" h="h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
