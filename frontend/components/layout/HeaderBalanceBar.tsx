'use client'

import { useCallback, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { indexL3, settlementChain } from '@/lib/wagmi'
import { useDeployment } from '@/hooks/useDeployment'
import {
  VISION_USDC_DECIMALS,
  SETTLEMENT_USDC_DECIMALS,
} from '@/lib/vision/constants'

type Context = 'vision' | 'itp' | 'both'

const ERC20_BALANCE_ABI = [{
  inputs: [{ name: 'account', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
}] as const

function resolveContext(pathname: string | null): Context {
  if (!pathname) return 'vision'
  // strip locale prefix like /en, /fr, /es
  const stripped = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/'
  if (stripped.startsWith('/profile')) return 'both'
  if (stripped === '/index' || stripped.startsWith('/index/')) return 'itp'
  return 'vision'
}

function formatBalance(raw: bigint, decimals: number): string {
  const num = parseFloat(formatUnits(raw, decimals))
  if (num === 0) return '0'
  if (num < 0.01) return '<0.01'
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const FAUCET_ENABLED = process.env.NEXT_PUBLIC_FAUCET_ENABLED === 'true'
const ONRAMP_NETWORK = process.env.NEXT_PUBLIC_ONRAMP_NETWORK || 'sonic'

interface LegProps {
  label: string
  balance: bigint | undefined
  decimals: number
  isDark: boolean
  scope: 'vision' | 'itp'
  address: `0x${string}` | undefined
  onMinted: () => void
}

function BalanceLeg({ label, balance, decimals, isDark, scope, address, onMinted }: LegProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const handleFaucet = useCallback(async () => {
    if (!address || state === 'loading') return
    setState('loading')
    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount: '1000', scope }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || 'faucet failed')
      const leg = scope === 'vision' ? data.vision : data.itp
      if (leg?.usdc?.error) throw new Error(leg.usdc.error)
      setState('done')
      // Stagger refetches — the chain may take a block or two to surface
      // the new balance. Once it's > 0, the parent's zero-balance branch
      // hides this whole leg and the user sees their USDC in the navbar.
      onMinted()
      setTimeout(onMinted, 1500)
      setTimeout(onMinted, 4000)
      setTimeout(onMinted, 8000)
      // If the balance still hasn't surfaced after 15s, the refetch chain has
      // exhausted itself and the user should be able to try again rather than
      // stare at a permanent "1K sent" badge.
      setTimeout(() => setState('idle'), 15000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }, [address, state, scope, onMinted])

  if (balance === undefined) return null

  const zero = balance === 0n

  // Zero balance: faucet (testnet) or onramp (mainnet).
  if (zero) {
    if (FAUCET_ENABLED) {
      return (
        <button
          onClick={handleFaucet}
          disabled={state === 'loading'}
          className={`inline-flex items-center gap-1 text-[11px] font-semibold font-mono tabular-nums px-2 py-1 rounded transition-colors ${
            isDark
              ? 'text-color-up hover:bg-white/10'
              : 'text-color-up hover:bg-surface'
          }`}
          title={`${label} balance — claim test funds`}
        >
          <span className="text-text-muted font-medium">{label}</span>
          <span>
            {state === 'loading' ? 'Minting…'
              : state === 'done' ? '1K sent'
              : state === 'error' ? 'Retry'
              : 'Get USDC'}
          </span>
        </button>
      )
    }
    if (!address) return null
    return (
      <a
        href={`https://onramp.money/main/buy/?appId=1&coinCode=usdc&network=${ONRAMP_NETWORK}&walletAddress=${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
          isDark
            ? 'bg-color-up/20 text-color-up hover:bg-color-up/30'
            : 'bg-surface-up text-color-up hover:bg-surface-up/80'
        }`}
      >
        <span className="font-mono text-text-muted font-medium">{label}</span>
        <span>Deposit</span>
      </a>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[12px] font-semibold font-mono tabular-nums tracking-tight ${
        isDark ? 'text-text-inverse-muted' : 'text-text-secondary'
      }`}
      title={`${label} balance`}
    >
      <span className="text-text-muted font-medium">{label}</span>
      {formatBalance(balance, decimals)}
      <span className="text-text-muted font-medium">USDC</span>
    </span>
  )
}

interface Props {
  isDark: boolean
}

export function HeaderBalanceBar({ isDark }: Props) {
  const pathname = usePathname()
  const context = resolveContext(pathname)
  const { address } = useAccount()
  const { getAddress } = useDeployment()

  const l3Usdc = getAddress('L3_WUSDC')
  const settlementUsdc = getAddress('SETTLEMENT_USDC')

  const wantVision = context === 'vision' || context === 'both'
  const wantItp = context === 'itp' || context === 'both'

  const { data: l3Raw, refetch: refetchL3 } = useReadContract({
    address: l3Usdc,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: {
      enabled: !!address && wantVision && l3Usdc !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 15_000,
    },
  })

  const { data: settRaw, refetch: refetchSettlement } = useReadContract({
    address: settlementUsdc,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: settlementChain.id,
    query: {
      enabled: !!address && wantItp && settlementUsdc !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 15_000,
    },
  })

  if (!address) return null

  const visionBalance = (l3Raw as bigint | undefined)
  const itpBalance = (settRaw as bigint | undefined)

  return (
    <span className="hidden sm:inline-flex items-center gap-2">
      {wantVision && (
        <BalanceLeg
          label="Vision"
          balance={visionBalance}
          decimals={VISION_USDC_DECIMALS}
          isDark={isDark}
          scope="vision"
          address={address}
          onMinted={() => refetchL3()}
        />
      )}
      {wantItp && (
        <BalanceLeg
          label="ITP"
          balance={itpBalance}
          decimals={SETTLEMENT_USDC_DECIMALS}
          isDark={isDark}
          scope="itp"
          address={address}
          onMinted={() => refetchSettlement()}
        />
      )}
    </span>
  )
}
