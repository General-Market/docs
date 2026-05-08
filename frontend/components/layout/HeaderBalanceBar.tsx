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

  return (
    <span className="hidden sm:inline-flex items-center gap-2">
      {zero ? (
        FAUCET_ENABLED ? (
          <button
            onClick={handleFaucet}
            disabled={state === 'loading'}
            className={`inline-flex items-center gap-1 text-[11px] font-semibold font-mono tabular-nums px-2 py-1 rounded transition-colors ${
              isDark
                ? 'text-color-up hover:bg-white/10'
                : 'text-color-up hover:bg-surface'
            }`}
            title="Claim test USDC"
          >
            <span>
              {state === 'loading' ? 'Minting…'
                : state === 'done' ? '1K sent'
                : state === 'error' ? 'Retry'
                : 'Get USDC'}
            </span>
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
