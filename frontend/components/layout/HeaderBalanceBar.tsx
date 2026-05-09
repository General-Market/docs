'use client'

import { useCallback, useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { indexL3 } from '@/lib/wagmi'
import { useDeployment } from '@/hooks/useDeployment'
import { VISION_USDC_DECIMALS } from '@/lib/vision/constants'
import { useWaitlistGate } from '@/components/waitlist/WaitlistGateProvider'

const ERC20_BALANCE_ABI = [{
  inputs: [{ name: 'account', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
}] as const

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

interface Props {
  isDark: boolean
}

export function HeaderBalanceBar({ isDark }: Props) {
  const { address } = useAccount()
  const { getAddress } = useDeployment()
  const { requireWhitelist } = useWaitlistGate()
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const l3Usdc = getAddress('L3_WUSDC')

  const { data: l3Raw, refetch } = useReadContract({
    address: l3Usdc,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: {
      enabled: !!address && l3Usdc !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 15_000,
    },
  })

  const handleFaucet = useCallback(() => {
    if (!address || state === 'loading') return
    requireWhitelist(async () => {
      setState('loading')
      try {
        const res = await fetch('/api/faucet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, amount: '1000' }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.error) throw new Error(data.error || 'faucet failed')
        if (data.vision?.usdc?.error) throw new Error(data.vision.usdc.error)
        setState('done')
        refetch()
        setTimeout(refetch, 1500)
        setTimeout(refetch, 4000)
        setTimeout(refetch, 8000)
        setTimeout(() => setState('idle'), 15000)
      } catch {
        setState('error')
        setTimeout(() => setState('idle'), 3000)
      }
    })
  }, [address, state, refetch, requireWhitelist])

  if (!address) return null

  const balance = l3Raw as bigint | undefined
  if (balance === undefined) return null

  const zero = balance === 0n

  const label =
    state === 'loading' ? 'Minting…'
      : state === 'done' ? '1,000 USDC sent'
      : state === 'error' ? 'Retry'
      : 'Get USDC'

  return (
    <span className="hidden sm:inline-flex items-center gap-2">
      {zero ? (
        FAUCET_ENABLED ? (
          <button
            onClick={handleFaucet}
            disabled={state === 'loading'}
            title="Claim 1,000 test USDC"
            className={`group inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-semibold tracking-[-0.005em] transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed ${
              state === 'done'
                ? 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30'
                : state === 'error'
                  ? 'bg-red-500/10 text-red-600 ring-1 ring-red-500/30 hover:bg-red-500/15'
                  : isDark
                    ? 'bg-white/8 text-white ring-1 ring-white/15 hover:bg-white/12 hover:ring-white/25'
                    : 'bg-zinc-900 text-white ring-1 ring-black/10 hover:bg-zinc-800 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_2px_6px_rgba(0,0,0,0.06)]'
            }`}
          >
            <span
              aria-hidden
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
                state === 'done'
                  ? 'bg-emerald-500/20'
                  : state === 'error'
                    ? 'bg-red-500/20'
                    : 'bg-white/10'
              }`}
            >
              {state === 'loading' ? (
                <span className="h-3 w-3 rounded-full border-[1.5px] border-current border-t-transparent animate-spin" />
              ) : state === 'done' ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : state === 'error' ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="8" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12" y2="17" />
                </svg>
              ) : (
                // Droplet glyph — testnet faucet, dripping
                <svg width="11" height="13" viewBox="0 0 24 28" fill="currentColor" aria-hidden>
                  <path d="M12 2 C6 10, 4 14, 4 18 a8 8 0 0 0 16 0 c0-4-2-8-8-16z" />
                </svg>
              )}
            </span>
            <span className="font-mono tabular-nums">{label}</span>
          </button>
        ) : (
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
            <span>Deposit USDC</span>
          </a>
        )
      ) : (
        <span
          className={`inline-flex items-center gap-1 text-[12px] font-semibold font-mono tabular-nums tracking-tight ${
            isDark ? 'text-text-inverse-muted' : 'text-text-secondary'
          }`}
          title="USDC balance"
        >
          {formatBalance(balance, VISION_USDC_DECIMALS)}
          <span className="text-text-muted font-medium">USDC</span>
        </span>
      )}
    </span>
  )
}
