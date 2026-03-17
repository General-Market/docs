'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { indexL3 } from '@/lib/wagmi'
import { formatUnits } from 'viem'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useMetaMorphoVault } from '@/hooks/useMetaMorphoVault'
import { useMorphoMarkets } from '@/hooks/useMorphoMarkets'
import { useMorphoPosition } from '@/hooks/useMorphoPosition'
import { VaultDeposit } from '@/components/lending/VaultDeposit'
import { VaultPosition } from '@/components/lending/VaultPosition'
import { BorrowUsdc } from '@/components/lending/BorrowUsdc'
import { RepayDebt } from '@/components/lending/RepayDebt'
import { LendItpModal } from './LendItpModal'
import { BRIDGED_ITP_ABI, INDEX_ABI } from '@/lib/contracts/index-protocol-abi'
import { getAllMorphoMarkets, getMorphoMarketForItp } from '@/lib/contracts/morpho-markets-registry'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { useTranslations } from 'next-intl'
import itpIdNames from '@/lib/itp-id-names.json'
import Link from 'next/link'

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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white border border-border-light rounded-md max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-modal relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 sm:px-6 pb-6">
          <button onClick={onClose} className="absolute top-4 right-4 text-text-muted hover:text-text-primary text-2xl">&times;</button>
          {lendContent}
        </div>
      </div>
    </div>
  )
}

/* ── Dashboard Content ── */
function LendDashboard({ activeAction, toggleAction }: { activeAction: ActiveAction; toggleAction: (a: ActiveAction) => void }) {
  const t = useTranslations('lending')
  const { vaultInfo, userPosition, refetch: refetchVault } = useMetaMorphoVault()
  const { markets, refetch: refetchMarkets } = useMorphoMarkets()
  const { position, refetch: refetchPosition } = useMorphoPosition()

  // State for the borrow modal opened from the markets table
  const [borrowModalItp, setBorrowModalItp] = useState<{
    settlementAddress: string
    name: string
  } | null>(null)

  // Listen for lending-refresh events (dispatched by BorrowUsdc, RepayDebt, etc.)
  useEffect(() => {
    const handleRefresh = () => {
      refetchVault()
      refetchMarkets()
      refetchPosition()
    }
    window.addEventListener('lending-refresh', handleRefresh)
    return () => window.removeEventListener('lending-refresh', handleRefresh)
  }, [refetchVault, refetchMarkets, refetchPosition])

  const market = markets[0]
  const supplyApy = vaultInfo?.apy ?? 0
  const borrowApy = market?.borrowApy ?? 0
  const utilization = vaultInfo?.utilization ?? 0

  // Format vault TVL
  const vaultTvl = vaultInfo?.totalAssets
    ? `$${parseFloat(formatUnits(vaultInfo.totalAssets, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : '--'

  // User supply data
  const userDeposits = userPosition?.value
    ? `$${parseFloat(formatUnits(userPosition.value, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00'
  // Accrued interest estimate (value - original deposit, simplified)
  const accruedInterest = userPosition?.value && userPosition.value > 0n
    ? `+$${(parseFloat(formatUnits(userPosition.value, 18)) * (supplyApy / 100)).toFixed(2)}`
    : '$0.00'

  // User borrow data
  const collateralValue = position?.collateralAmount
    ? `$${(parseFloat(formatUnits(position.collateralAmount, 18)) * (market ? parseFloat(formatUnits(market.navPrice, 36)) : 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00'
  const outstandingDebt = position?.debtAmount
    ? `$${parseFloat(formatUnits(position.debtAmount, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00'
  const maxBorrow = position?.maxBorrow
    ? `$${parseFloat(formatUnits(position.maxBorrow, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00'
  const lltvPercent = market?.lltvPercent ?? 70

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-border-light">
        <StatCell label={t('stats.vault_tvl')} value={vaultTvl} />
        <StatCell label={t('stats.supply_apy')} value={`${supplyApy.toFixed(2)}%`} color="text-color-up" />
        <StatCell label={t('stats.borrow_apy')} value={`${borrowApy.toFixed(2)}%`} />
        <StatCell label={t('stats.utilization')} value={`${utilization.toFixed(1)}%`} />
      </div>

      {/* Two-column: Supply | Borrow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* LEFT — Supply / USDC Vault */}
        <div className="border border-border-light">
          <div className="bg-black text-white px-5 py-3 text-caption font-bold uppercase tracking-[0.08em]">
            {t('supply_panel.title')}
          </div>
          <div className="p-5 space-y-4">
            <InfoRow label={t('supply_panel.your_deposits')} value={userDeposits} />
            <InfoRow label={t('supply_panel.accrued_interest')} value={accruedInterest} valueColor="text-color-up" />
            <InfoRow label={t('supply_panel.current_apy')} value={`${supplyApy.toFixed(2)}%`} mono />

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => toggleAction('deposit')}
                className={`py-2.5 font-bold text-caption uppercase tracking-[0.08em] transition-colors ${
                  activeAction === 'deposit'
                    ? 'bg-terminal text-white'
                    : 'bg-brand text-white hover:bg-brand-dark'
                }`}
              >
                {t('actions.deposit')}
              </button>
              <button
                onClick={() => toggleAction('withdraw')}
                className={`py-2.5 font-bold text-caption uppercase tracking-[0.08em] border transition-colors ${
                  activeAction === 'withdraw'
                    ? 'bg-muted border-black text-text-primary'
                    : 'border-border-medium text-text-primary hover:bg-muted'
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

        {/* RIGHT — Borrow / Against ITP */}
        <div className="border border-border-light">
          <div className="bg-black text-white px-5 py-3 text-caption font-bold uppercase tracking-[0.08em]">
            {t('borrow_panel.title')}
          </div>
          <div className="p-5 space-y-4">
            <InfoRow label={t('borrow_panel.collateral_value')} value={collateralValue} />
            <InfoRow label={t('borrow_panel.outstanding_debt')} value={outstandingDebt} />
            <InfoRow label={t('borrow_panel.max_borrow', { lltv: lltvPercent.toFixed(0) })} value={maxBorrow} />

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => toggleAction('borrow')}
                className={`py-2.5 font-bold text-caption uppercase tracking-[0.08em] transition-colors ${
                  activeAction === 'borrow'
                    ? 'bg-terminal text-white'
                    : 'bg-brand text-white hover:bg-brand-dark'
                }`}
              >
                {t('actions.borrow_usdc')}
              </button>
              <button
                onClick={() => toggleAction('repay')}
                className={`py-2.5 font-bold text-caption uppercase tracking-[0.08em] border transition-colors ${
                  activeAction === 'repay'
                    ? 'bg-muted border-black text-text-primary'
                    : 'border-border-medium text-text-primary hover:bg-muted'
                }`}
              >
                {t('actions.repay')}
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
      <MarketsTableInline
        liveMarkets={markets}
        onBorrow={(settlementAddress, name) => setBorrowModalItp({ settlementAddress, name })}
        activeBorrowCollaterals={
          position?.debtAmount && position.debtAmount > 0n
            ? new Set([MORPHO_ADDRESSES.collateralToken.toLowerCase()])
            : new Set()
        }
      />

      {/* Borrow modal opened from markets table row */}
      {borrowModalItp && (
        <LendItpModal
          itpInfo={{
            id: borrowModalItp.settlementAddress,
            name: borrowModalItp.name,
            symbol: '',
            admin: '',
            createdAt: 0,
            source: 'index',
            completed: true,
            settlementAddress: borrowModalItp.settlementAddress,
          }}
          isOpen={true}
          onClose={() => setBorrowModalItp(null)}
        />
      )}
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
import type { MarketInfo } from '@/lib/types/morpho'

interface MarketsTableInlineProps {
  liveMarkets: MarketInfo[]
  onBorrow: (collateralToken: string, itpName: string) => void
  activeBorrowCollaterals: Set<string>
}

function MarketsTableInline({ liveMarkets, onBorrow, activeBorrowCollaterals }: MarketsTableInlineProps) {
  const t = useTranslations('lending')
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: indexL3.id })
  const [itpNames, setItpNames] = useState<Map<string, string>>(new Map())
  const [userBalances, setUserBalances] = useState<Map<string, bigint>>(new Map())
  const [onChainVaults, setOnChainVaults] = useState<string[]>([])
  // Reverse map: vault address → itpId (full 0x-padded hex)
  const [vaultToItpId, setVaultToItpId] = useState<Map<string, string>>(new Map())
  // Dynamic market discovery: collateral tokens found in the vault's supply queue
  const [vaultMarketCollaterals, setVaultMarketCollaterals] = useState<Set<string>>(new Set())
  const publicClientRef = useRef(publicClient)

  useEffect(() => { publicClientRef.current = publicClient }, [publicClient])

  // Discover all ITP vaults from the Index contract on-chain
  useEffect(() => {
    const discoverVaults = async () => {
      const client = publicClientRef.current
      if (!client) return
      try {
        const count = await client.readContract({
          address: INDEX_PROTOCOL.index,
          abi: INDEX_ABI,
          functionName: 'getItpCount',
        }) as bigint
        const vaults: string[] = []
        const idMap = new Map<string, string>()
        for (let i = 1n; i <= count; i++) {
          const itpId = '0x' + i.toString(16).padStart(64, '0') as `0x${string}`
          try {
            const vault = await client.readContract({
              address: INDEX_PROTOCOL.index,
              abi: INDEX_ABI,
              functionName: 'itpVaults',
              args: [itpId],
            }) as string
            if (vault && vault !== '0x0000000000000000000000000000000000000000') {
              vaults.push(vault)
              idMap.set(vault.toLowerCase(), itpId)
            }
          } catch { /* skip */ }
        }
        setOnChainVaults(vaults)
        setVaultToItpId(idMap)
      } catch { /* Index contract not available */ }
    }
    discoverVaults()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Discover authorized markets from the MetaMorpho vault's supply queue
  // This is the dynamic counterpart to the static batch-markets.json
  useEffect(() => {
    const discoverVaultMarkets = async () => {
      const client = publicClientRef.current
      if (!client) return
      try {
        const queueLen = await client.readContract({
          address: MORPHO_ADDRESSES.metaMorphoVault,
          abi: [{ name: 'supplyQueueLength', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
          functionName: 'supplyQueueLength',
        }) as bigint
        const collaterals = new Set<string>()
        for (let i = 0n; i < queueLen; i++) {
          try {
            const marketId = await client.readContract({
              address: MORPHO_ADDRESSES.metaMorphoVault,
              abi: [{ name: 'supplyQueue', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'bytes32' }] }],
              functionName: 'supplyQueue',
              args: [i],
            }) as `0x${string}`
            // Read market params from Morpho core to get collateral token
            const params = await client.readContract({
              address: MORPHO_ADDRESSES.morpho,
              abi: [{ name: 'idToMarketParams', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'uint256' }] }],
              functionName: 'idToMarketParams',
              args: [marketId],
            }) as readonly [string, string, string, string, bigint]
            const collateralToken = params[1] // loanToken, collateralToken, oracle, irm, lltv
            if (collateralToken && collateralToken !== '0x0000000000000000000000000000000000000000') {
              collaterals.add(collateralToken.toLowerCase())
            }
          } catch { /* skip individual market read failures */ }
        }
        setVaultMarketCollaterals(collaterals)
      } catch { /* vault not available */ }
    }
    discoverVaultMarkets()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Get all registered markets from the registry
  const allRegistryMarkets = getAllMorphoMarkets()

  // Build a set of collateral tokens from live + registry + on-chain discovered vaults
  const allCollateralTokens = Array.from(new Set([
    ...liveMarkets.map(m => m.params.collateralToken),
    ...allRegistryMarkets.map(m => m.collateralToken),
    ...onChainVaults,
  ]))

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
        nameMap.set(addr, 'ITP')
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

  // Build live market lookup by collateral token
  const liveByCollateral = new Map(liveMarkets.map(m => [m.params.collateralToken.toLowerCase(), m]))

  // Build rows: one per unique collateral token, with live data where available
  const namesMap = itpIdNames as Record<string, { name: string; ticker: string }>
  const rows = allCollateralTokens.map(addr => {
    const live = liveByCollateral.get(addr.toLowerCase())
    const registry = getMorphoMarketForItp(addr)
    const itpId = vaultToItpId.get(addr.toLowerCase()) || ''
    const idEntry = itpId ? namesMap[itpId] : undefined
    const itpNum = itpId ? parseInt(itpId.slice(2), 16) : 0
    const name = idEntry?.name || itpNames.get(addr) || (itpNum ? `ITP #${itpNum}` : 'ITP')
    const ticker = idEntry?.ticker || ''
    const userBal = userBalances.get(addr) ?? 0n
    const lltv = registry ? Number(registry.lltv) / 1e16 : 77

    return {
      collateralToken: addr,
      itpId,
      name,
      ticker,
      userBalance: userBal,
      supplyApy: live && live.borrowApy > 0 ? (live.borrowApy * (live.utilization / 100)).toFixed(2) : '--',
      borrowApy: live ? live.borrowApy.toFixed(2) : '--',
      tvl: live && live.totalBorrowed > 0n
        ? `$${(parseFloat(formatUnits(live.totalBorrowed, 18)) / (live.utilization / 100 || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : '--',
      tvlRaw: live && live.totalBorrowed > 0n
        ? parseFloat(formatUnits(live.totalBorrowed, 18)) / (live.utilization / 100 || 1)
        : 0,
      utilization: live ? `${live.utilization.toFixed(1)}%` : '--',
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
      <div className="bg-black text-white px-5 py-3">
        <p className="text-micro font-semibold uppercase tracking-[0.08em] mb-0.5">{t('markets_table.section_label')}</p>
        <p className="text-body font-bold">{t('markets_table.section_title')}</p>
      </div>

      <div className="border border-border-light border-t-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-label font-semibold uppercase tracking-[0.08em] text-text-muted border-b border-border-light">
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
                <tr key={row.collateralToken} className="border-b border-border-light last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 sm:px-4 py-3">
                    {row.itpId ? (
                      <Link href={`/itp/${row.itpId}`} className="flex items-center gap-2 group">
                        <div className="w-7 h-7 bg-muted rounded-full flex items-center justify-center shrink-0">
                          <span className="text-text-primary text-micro font-bold">{row.ticker ? row.ticker.slice(0, 4) : row.name.slice(0, 3)}</span>
                        </div>
                        <span className="font-semibold text-text-primary text-sm group-hover:underline">{t('markets_table.market_pair', { name: row.name })}</span>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-muted rounded-full flex items-center justify-center shrink-0">
                          <span className="text-text-primary text-micro font-bold">{row.name.slice(0, 3)}</span>
                        </div>
                        <span className="font-semibold text-text-primary text-sm">{t('markets_table.market_pair', { name: row.name })}</span>
                      </div>
                    )}
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
  return <div className={`${w} ${h} bg-border-light rounded animate-pulse`} />
}

function LendSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-border-light">
        {['Vault TVL', 'Supply APY', 'Borrow APY', 'Utilization'].map((label, idx) => (
          <div key={label} className="px-5 py-4 border-b lg:border-b-0 border-r border-border-light last:border-r-0">
            <p className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">{label}</p>
            <Bone w={idx === 0 ? 'w-20' : 'w-16'} h="h-7" />
          </div>
        ))}
      </div>

      {/* Two-column panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Supply */}
        <div className="border border-border-light">
          <div className="bg-black text-white px-5 py-3 text-caption font-bold uppercase tracking-[0.08em]">
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
          <div className="bg-black text-white px-5 py-3 text-caption font-bold uppercase tracking-[0.08em]">
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
