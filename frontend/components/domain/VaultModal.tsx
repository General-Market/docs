'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { indexL3 } from '@/lib/wagmi'
import { formatUnits } from 'viem'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useMetaMorphoVault } from '@/hooks/useMetaMorphoVault'
import { useMorphoPosition } from '@/hooks/useMorphoPosition'
import { useAllMorphoMarkets, type AllMarketData } from '@/hooks/useAllMorphoMarkets'
import { VaultDeposit } from '@/components/lending/VaultDeposit'
import { VaultPosition } from '@/components/lending/VaultPosition'
import { BorrowUsdc } from '@/components/lending/BorrowUsdc'
import { RepayDebt } from '@/components/lending/RepayDebt'
import { DepositCollateral } from '@/components/lending/DepositCollateral'
import { CollateralSelector, type SelectedCollateral } from '@/components/lending/CollateralSelector'
import { BRIDGED_ITP_ABI } from '@/lib/contracts/index-protocol-abi'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { getMorphoMarketForItp } from '@/lib/contracts/morpho-markets-registry'
import { useTranslations } from 'next-intl'
import { SpringModal, SpringBackdrop, glass, ModalClose } from '@/components/ui/spring'

// Note: Error fallback uses static English because it renders outside i18n context
const LendingErrorFallback = (
  <div className="bg-surface-down border border-color-down/30 rounded-card p-6 text-center">
    <h3 className="text-color-down font-bold mb-2">Module failed to load</h3>
    <p className="text-text-muted text-sm">Refresh the page to retry.</p>
  </div>
)

interface VaultModalProps {
  onClose: () => void
  inline?: boolean
}

type ActiveAction = null | 'deposit' | 'withdraw' | 'borrow' | 'repay'

export function VaultModal({ onClose, inline }: VaultModalProps) {
  const t = useTranslations('lending')
  const { isConnected } = useAccount()
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)

  const toggleAction = (action: ActiveAction) => {
    setActiveAction(prev => prev === action ? null : action)
  }

  const header = (
    <div className="pt-10 mb-6">
      <p className="text-label font-semibold tracking-[0.08em] uppercase text-text-muted mb-1.5">{t('heading.label')}</p>
      <h2 className="text-display font-black text-black">{t('heading.title')}</h2>
      <p className="text-body text-text-secondary mt-1.5">{t('heading.description')}</p>
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
    <SpringBackdrop className={glass.backdrop} onClick={onClose}>
      <SpringModal
        className={`${glass.modal} max-w-4xl w-full relative`}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 sm:px-6 pb-6">
          <ModalClose onClick={onClose} className="absolute top-4 right-4" />
          {lendContent}
        </div>
      </SpringModal>
    </SpringBackdrop>
  )
}

/* ── Dashboard Content ── */
function LendDashboard({ activeAction, toggleAction }: { activeAction: ActiveAction; toggleAction: (a: ActiveAction) => void }) {
  const t = useTranslations('lending')
  const { vaultInfo, userPosition, refetch: refetchVault } = useMetaMorphoVault()
  const { data: allMarketData } = useAllMorphoMarkets()

  // Selected ITP for borrow flow (from collateral selector or markets table shortcut)
  const [selectedCollateral, setSelectedCollateral] = useState<SelectedCollateral | null>(null)

  // Position data uses the selected market (or singleton fallback)
  const { position, oraclePrice, refetch: refetchPosition } = useMorphoPosition(selectedCollateral?.market)

  // Listen for lending-refresh events (dispatched by BorrowUsdc, RepayDebt, etc.)
  useEffect(() => {
    const handleRefresh = () => {
      refetchVault()
      refetchPosition()
    }
    window.addEventListener('lending-refresh', handleRefresh)
    return () => window.removeEventListener('lending-refresh', handleRefresh)
  }, [refetchVault, refetchPosition])

  const { totalSupply, totalBorrow, weightedBorrowApy } = useMemo(() => {
    let ts = 0n, tb = 0n, weightedRate = 0
    if (allMarketData) {
      for (const m of allMarketData.values()) {
        ts += m.totalSupplyAssets
        tb += m.totalBorrowAssets
        weightedRate += m.borrowApy * Number(m.totalBorrowAssets)
      }
    }
    return {
      totalSupply: ts,
      totalBorrow: tb,
      weightedBorrowApy: tb > 0n ? weightedRate / Number(tb) : 0,
    }
  }, [allMarketData])
  const borrowApy = weightedBorrowApy
  const utilization = totalSupply > 0n ? Number((totalBorrow * 10000n) / totalSupply) / 100 : 0
  const supplyApy = borrowApy > 0 ? borrowApy * utilization / 100 : (vaultInfo?.apy ?? 0)

  // Format vault TVL
  const vaultTvl = vaultInfo?.totalAssets
    ? `$${parseFloat(formatUnits(vaultInfo.totalAssets, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : '--'

  // User supply data
  const userDeposits = userPosition?.value
    ? `$${parseFloat(formatUnits(userPosition.value, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00'
  // Projected annual yield (not actual accrued — vault doesn't track original deposit)
  const annualYield = userPosition?.value && userPosition.value > 0n && supplyApy > 0
    ? `+$${(parseFloat(formatUnits(userPosition.value, 18)) * (supplyApy / 100)).toFixed(2)}/yr`
    : utilization === 0 ? t('supply_panel.no_borrows_yet') : '$0.00'

  // User borrow data
  const oraclePriceNum = oraclePrice ? parseFloat(formatUnits(oraclePrice, 36)) : 1
  const collateralValue = position?.collateralAmount
    ? `$${(parseFloat(formatUnits(position.collateralAmount, 18)) * oraclePriceNum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—'
  const outstandingDebt = position?.debtAmount
    ? `$${parseFloat(formatUnits(position.debtAmount, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—'
  const maxBorrow = position?.maxBorrow
    ? `$${parseFloat(formatUnits(position.maxBorrow, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—'
  const lltvPercent = allMarketData && allMarketData.size > 0
    ? Number([...allMarketData.values()][0].lltv) / 1e16
    : 77

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-black/[0.06] rounded-xl overflow-hidden">
        <StatCell label={t('stats.vault_tvl')} value={vaultTvl} />
        <StatCell label={t('stats.supply_apy')} value={supplyApy > 0 ? `${supplyApy.toFixed(2)}%` : '—'} color={supplyApy > 0 ? 'text-color-up' : 'text-text-muted'} />
        <StatCell label={t('stats.borrow_apy')} value={borrowApy > 0 ? `${borrowApy.toFixed(2)}%` : '—'} />
        <StatCell label={t('stats.utilization')} value={`${utilization.toFixed(1)}%`} />
      </div>

      {/* Two-column: Supply | Borrow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* LEFT — Supply / USDC Vault */}
        <div className="border border-black/[0.06] rounded-xl overflow-hidden">
          <div className="bg-black/90 text-white px-5 py-3 text-caption font-bold uppercase tracking-[0.08em] rounded-t-xl">
            {t('supply_panel.title')}
          </div>
          <div className="p-5 space-y-4">
            <InfoRow label={t('supply_panel.your_deposits')} value={userDeposits} />
            <InfoRow
              label={supplyApy > 0 ? t('supply_panel.est_annual_yield') : t('supply_panel.yield_status')}
              value={annualYield}
              valueColor={supplyApy > 0 ? 'text-color-up' : 'text-text-muted'}
            />
            <InfoRow label={t('supply_panel.current_apy')} value={`${supplyApy.toFixed(2)}%`} mono />
            {utilization === 0 && userPosition?.value && userPosition.value > 0n && (
              <p className="text-[11px] text-text-muted leading-snug">
                {t('supply_panel.no_borrows_notice')}
              </p>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => toggleAction('deposit')}
                className={`py-2.5 font-bold text-caption uppercase tracking-[0.08em] transition-colors ${
                  activeAction === 'deposit'
                    ? 'bg-black/80 text-white'
                    : 'bg-brand text-white hover:bg-brand-dark'
                }`}
              >
                {t('actions.deposit')}
              </button>
              <button
                onClick={() => toggleAction('withdraw')}
                className={`py-2.5 font-bold text-caption uppercase tracking-[0.08em] border transition-colors ${
                  activeAction === 'withdraw'
                    ? 'bg-black/[0.05] border-black/20 text-text-primary'
                    : 'border-black/10 text-text-primary hover:bg-black/[0.04]'
                }`}
              >
                {t('actions.withdraw')}
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

        {/* RIGHT — Borrow USDC */}
        <div className="border border-black/[0.06] rounded-xl overflow-hidden">
          <div className="bg-black/90 text-white px-5 py-3 text-caption font-bold uppercase tracking-[0.08em] rounded-t-xl">
            {t('borrow_panel.title')}
          </div>
          <div className="p-5 space-y-4">
            {/* Position summary (always visible when position exists) */}
            {selectedCollateral && (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-border-light">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center shrink-0">
                      <span className="text-text-primary text-[9px] font-bold">{selectedCollateral.symbol.slice(0, 3)}</span>
                    </div>
                    <span className="text-sm font-semibold text-text-primary">{selectedCollateral.name}</span>
                  </div>
                  <button
                    onClick={() => { setSelectedCollateral(null); toggleAction(null) }}
                    className="text-micro font-semibold text-text-muted hover:text-text-primary transition-colors"
                  >
                    {t('borrow_panel.change_itp')}
                  </button>
                </div>
                <InfoRow label={t('borrow_panel.collateral_value')} value={collateralValue} />
                <InfoRow label={t('borrow_panel.outstanding_debt')} value={outstandingDebt} />
                <InfoRow label={t('borrow_panel.max_borrow', { lltv: lltvPercent.toFixed(0) })} value={maxBorrow} />
              </>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => toggleAction('borrow')}
                className={`py-2.5 font-bold text-caption uppercase tracking-[0.08em] transition-colors ${
                  activeAction === 'borrow'
                    ? 'bg-black/80 text-white'
                    : 'bg-brand text-white hover:bg-brand-dark'
                }`}
              >
                {t('actions.borrow_usdc')}
              </button>
              <button
                onClick={() => toggleAction('repay')}
                className={`py-2.5 font-bold text-caption uppercase tracking-[0.08em] border transition-colors ${
                  activeAction === 'repay'
                    ? 'bg-black/[0.05] border-black/20 text-text-primary'
                    : 'border-black/10 text-text-primary hover:bg-black/[0.04]'
                }`}
              >
                {t('actions.repay')}
              </button>
            </div>

            {/* Borrow flow: pick ITP first, then deposit + borrow */}
            {activeAction === 'borrow' && (
              <div className="border-t border-border-light pt-4">
                {!selectedCollateral ? (
                  <CollateralSelector onSelect={(c) => setSelectedCollateral(c)} />
                ) : (
                  <div className="space-y-4">
                    <DepositCollateral market={selectedCollateral.market} itpId={selectedCollateral.itpId} onSuccess={refetchPosition} />
                    <BorrowUsdc market={selectedCollateral.market} onSuccess={() => toggleAction(null)} />
                  </div>
                )}
              </div>
            )}

            {/* Repay flow */}
            {activeAction === 'repay' && selectedCollateral && (
              <div className="border-t border-border-light pt-4">
                <RepayDebt market={selectedCollateral.market} itpId={selectedCollateral.itpId} onSuccess={() => toggleAction(null)} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Markets Table */}
      <MarketsTableInline
        allMarketData={allMarketData}
        onBorrow={(settlementAddress, name) => {
          // Pre-select this ITP and open borrow flow inline
          const market = getMorphoMarketForItp(settlementAddress)
          if (market) {
            setSelectedCollateral({
              itpId: '',
              name,
              symbol: name,
              settlementAddress,
              market,
              balance: 0n,
              nav: 0,
            })
            toggleAction('borrow')
          }
        }}
        activeBorrowCollaterals={
          selectedCollateral
            ? new Set([selectedCollateral.settlementAddress.toLowerCase()])
            : position?.debtAmount && position.debtAmount > 0n
            ? new Set([MORPHO_ADDRESSES.collateralToken.toLowerCase()])
            : new Set()
        }
      />
    </div>
  )
}

/* ── Stat Cell ── */
function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="px-3 sm:px-5 py-3 sm:py-4 border-b lg:border-b-0 border-r border-border-light last:border-r-0">
      <p className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">{label}</p>
      <p className={`text-heading sm:text-title font-extrabold font-mono tabular-nums ${color || 'text-black'}`}>
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

interface MarketsTableInlineProps {
  allMarketData?: Map<string, AllMarketData>
  onBorrow: (collateralToken: string, itpName: string) => void
  activeBorrowCollaterals: Set<string>
}

function MarketsTableInline({ allMarketData, onBorrow, activeBorrowCollaterals }: MarketsTableInlineProps) {
  const t = useTranslations('lending')
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: indexL3.id })
  const [itpNames, setItpNames] = useState<Map<string, string>>(new Map())
  const [userBalances, setUserBalances] = useState<Map<string, bigint>>(new Map())
  const publicClientRef = useRef(publicClient)

  useEffect(() => { publicClientRef.current = publicClient }, [publicClient])

  // SSE-fed hook is the sole source of rows
  const allCollateralTokens = allMarketData ? [...allMarketData.keys()] : []

  // Fetch ITP names and user balances for all collateral tokens
  const fetchInfo = useCallback(async () => {
    const client = publicClientRef.current
    if (!client || allCollateralTokens.length === 0) return
    const nameMap = new Map<string, string>()
    const balMap = new Map<string, bigint>()
    for (const addr of allCollateralTokens) {
      if (nameMap.has(addr)) continue
      try {
        const name = await client.readContract({
          address: addr as `0x${string}`,
          abi: BRIDGED_ITP_ABI,
          functionName: 'name',
        }) as string
        nameMap.set(addr, name)
      } catch {
        nameMap.set(addr, 'DTF')
      }
      // Fetch user balance if connected
      if (address) {
        try {
          const bal = await client.readContract({
            address: addr as `0x${string}`,
            abi: BRIDGED_ITP_ABI,
            functionName: 'balanceOf',
            args: [address],
          }) as bigint
          balMap.set(addr, bal)
        } catch {
          balMap.set(addr, 0n)
        }
      }
    }
    setItpNames(nameMap)
    setUserBalances(balMap)
  }, [allCollateralTokens.join(','), address]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchInfo() }, [fetchInfo])

  // Build rows: one per SSE-fed market entry
  const rows = allCollateralTokens.map(addr => {
    const mktData = allMarketData?.get(addr)
    const name = itpNames.get(addr) || 'DTF'
    const userBal = userBalances.get(addr) ?? 0n
    const lltv = mktData ? Number(mktData.lltv) / 1e16 : 77

    const tvlRaw = mktData ? parseFloat(formatUnits(mktData.totalSupplyAssets, 18)) : 0

    return {
      collateralToken: addr,
      name,
      userBalance: userBal,
      borrowApy: mktData ? mktData.borrowApy.toFixed(2) : '--',
      tvl: mktData && mktData.totalSupplyAssets > 0n
        ? `$${tvlRaw.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : '--',
      tvlRaw,
      utilization: mktData ? `${mktData.utilization.toFixed(1)}%` : '--',
      lltv: `${lltv.toFixed(0)}%`,
    }
  })

  // Sort: user holdings first, then by TVL descending
  rows.sort((a, b) => {
    const aHas = a.userBalance > 0n ? 1 : 0
    const bHas = b.userBalance > 0n ? 1 : 0
    if (aHas !== bHas) return bHas - aHas
    return b.tvlRaw - a.tvlRaw
  })

  const isLoading = allCollateralTokens.length > 0 && itpNames.size === 0

  return (
    <div>
      <div className="bg-black/90 text-white px-5 py-3 rounded-t-xl">
        <p className="text-micro font-semibold uppercase tracking-[0.08em] mb-0.5">{t('markets_table.section_label')}</p>
        <p className="text-body font-bold">{t('markets_table.section_title')}</p>
      </div>

      <div className="border border-black/[0.06] border-t-0 rounded-b-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-label font-semibold uppercase tracking-[0.08em] text-text-muted border-b border-black/[0.06]">
              <th className="text-left px-3 sm:px-4 py-3">{t('markets_table.header.market')}</th>
              <th className="text-right px-3 sm:px-4 py-3 hidden sm:table-cell">{t('markets_table.header.my_balance')}</th>
              <th className="text-right px-3 sm:px-4 py-3">{t('markets_table.header.borrow_apy')}</th>
              <th className="text-right px-3 sm:px-4 py-3 hidden sm:table-cell">{t('markets_table.header.tvl')}</th>
              <th className="text-right px-3 sm:px-4 py-3 hidden sm:table-cell">{t('markets_table.header.lltv')}</th>
              <th className="text-right px-3 sm:px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-text-muted">{t('markets_table.loading')}</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-text-muted">{t('markets_table.no_markets')}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.collateralToken} className="border-b border-black/[0.04] last:border-0 hover:bg-black/[0.02] transition-colors">
                  <td className="px-3 sm:px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-muted rounded-full flex items-center justify-center shrink-0">
                        <span className="text-text-primary text-micro font-bold">{row.name.slice(0, 3)}</span>
                      </div>
                      <span className="font-semibold text-text-primary text-sm">{t('markets_table.market_pair', { name: row.name })}</span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right font-mono tabular-nums hidden sm:table-cell">
                    {row.userBalance > 0n ? (
                      <span className="text-text-primary">{parseFloat(formatUnits(row.userBalance, 18)).toFixed(2)}</span>
                    ) : (
                      <span className="text-text-muted">--</span>
                    )}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right font-mono tabular-nums text-text-primary">{row.borrowApy === '--' ? '--' : `${row.borrowApy}%`}</td>
                  <td className="px-3 sm:px-4 py-3 text-right font-mono tabular-nums text-text-primary hidden sm:table-cell">{row.tvl}</td>
                  <td className="px-3 sm:px-4 py-3 text-right font-mono tabular-nums text-text-primary hidden sm:table-cell">{row.lltv}</td>
                  <td className="px-4 py-3 text-right">
                    <WalletActionButton
                      onClick={() => onBorrow(row.collateralToken, row.name)}
                      className="px-3 py-1.5 bg-brand text-white text-label font-bold uppercase tracking-[0.08em] hover:bg-brand-dark transition-colors"
                    >
                      {activeBorrowCollaterals.has(row.collateralToken.toLowerCase())
                        ? t('actions.manage_position')
                        : t('actions.borrow')}
                    </WalletActionButton>
                  </td>
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
  return <div className={`${w} ${h} bg-black/[0.06] rounded animate-pulse`} />
}

function LendSkeleton() {
  const t = useTranslations('lending')
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-black/[0.06] rounded-xl overflow-hidden">
        {[t('stats.vault_tvl'), t('stats.supply_apy'), t('stats.borrow_apy'), t('stats.utilization')].map((label, idx) => (
          <div key={label} className="px-5 py-4 border-b lg:border-b-0 border-r border-border-light last:border-r-0">
            <p className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">{label}</p>
            <Bone w={idx === 0 ? 'w-20' : 'w-16'} h="h-7" />
          </div>
        ))}
      </div>

      {/* Two-column panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Supply */}
        <div className="border border-black/[0.06] rounded-xl overflow-hidden">
          <div className="bg-black/90 text-white px-5 py-3 text-caption font-bold uppercase tracking-[0.08em] rounded-t-xl">
            {t('supply_panel.title')}
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
        <div className="border border-black/[0.06] rounded-xl overflow-hidden">
          <div className="bg-black/90 text-white px-5 py-3 text-caption font-bold uppercase tracking-[0.08em] rounded-t-xl">
            {t('borrow_panel.title')}
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
        <div className="bg-black/90 text-white px-5 py-3 rounded-t-xl">
          <Bone w="w-28" h="h-3" />
          <div className="mt-1"><Bone w="w-44" h="h-5" /></div>
        </div>
        <div className="border border-black/[0.06] border-t-0 rounded-b-xl p-5 space-y-3">
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
