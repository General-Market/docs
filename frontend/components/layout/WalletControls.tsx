'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain, useReadContract } from 'wagmi'
import { truncateAddress } from '@/lib/utils/address'
import { indexL3 } from '@/lib/wagmi'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { USDC_ADDRESS, USDC_DECIMALS } from '@/lib/contracts/addresses'
import { VisionBalanceBar } from '@/components/domain/vision/VisionBalanceBar'
import { usePoints } from '@/hooks/usePoints'

interface WalletControlsProps {
  isDark: boolean
  showVisionBalance: boolean
}

export function WalletControls({ isDark, showVisionBalance }: WalletControlsProps) {
  const t = useTranslations('common')
  const [mounted, setMounted] = useState(false)

  const { address, isConnected } = useAccount()
  const authenticated = isConnected
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const injectedConnector = connectors.find(c => c.type === 'injected') || connectors[0]
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const isWrongNetwork = isConnected && chainId !== indexL3.id

  const { points } = usePoints(address)
  const isFaucetEnabled = process.env.NEXT_PUBLIC_FAUCET_ENABLED === 'true'
  const faucetKey = address ? `faucet_used_${address.toLowerCase()}` : ''
  const alreadyUsed = typeof window !== 'undefined' && !!faucetKey && !!localStorage.getItem(faucetKey)
  const [faucetState, setFaucetState] = useState<'idle' | 'loading' | 'done' | 'error'>(alreadyUsed ? 'done' : 'idle')

  const { data: usdcRaw, refetch: refetchUsdc } = useReadContract({
    address: USDC_ADDRESS,
    abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }] as const,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address, refetchInterval: 15_000 },
  })
  const usdcBalance = usdcRaw !== undefined ? Number(usdcRaw) / 10 ** USDC_DECIMALS : null

  const handleFaucet = useCallback(async () => {
    if (!address || faucetState === 'loading' || alreadyUsed) return
    setFaucetState('loading')
    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount: '1000', gas: true }),
      })
      if (!res.ok) throw new Error()
      localStorage.setItem(faucetKey, '1')
      setFaucetState('done')
    } catch {
      setFaucetState('error')
      setTimeout(() => setFaucetState('idle'), 3000)
    }
  }, [address, faucetState, alreadyUsed, faucetKey])

  useEffect(() => { setMounted(true) }, [])

  // Auto-switch to L3 on first connect only
  const hasAutoSwitched = useRef(false)
  useEffect(() => {
    if (isConnected && !hasAutoSwitched.current) {
      hasAutoSwitched.current = true
      if (isWrongNetwork && !isSwitching) {
        switchChain({ chainId: indexL3.id })
      }
    }
    if (!isConnected) hasAutoSwitched.current = false
  }, [isConnected, isWrongNetwork, isSwitching, switchChain])

  const { capture, identify, reset: resetPostHog } = usePostHogTracker()
  useEffect(() => {
    if (authenticated && address) {
      identify(address, { login_method: 'injected', chain_id: chainId })
      capture('wallet_connected', { wallet_address: address, chain_id: chainId })
    }
  }, [authenticated, address])

  const chainIdHex = `0x${indexL3.id.toString(16)}`

  const addAndSwitchChain = async () => {
    if (typeof window === 'undefined' || !window.ethereum) return
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainIdHex,
          chainName: indexL3.name,
          nativeCurrency: indexL3.nativeCurrency,
          rpcUrls: [indexL3.rpcUrls.default.http[0]],
        }],
      })
    } catch {}
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
    } catch {}
  }

  const handleLogin = async () => {
    capture('login_clicked', { source: 'header' })
    if (injectedConnector) {
      try { await addAndSwitchChain() } catch {}
      connect({ connector: injectedConnector, chainId: indexL3.id })
    }
  }

  const handleLogout = () => {
    capture('wallet_disconnected')
    resetPostHog()
    disconnect()
  }

  return (
    <>
      {/* Profile link */}
      {mounted && authenticated && address && (
        <Link
          href={`/profile/${address}`}
          className={`hidden sm:inline text-label font-bold transition-colors ${
            isDark ? 'text-zinc-400 hover:text-white' : 'text-text-muted hover:text-black'
          }`}
        >
          Portfolio
        </Link>
      )}
      {/* Points */}
      <Link
        href="/points"
        className={`text-label font-bold font-mono transition-colors ${
          isDark ? 'text-text-muted hover:text-white' : 'text-text-muted hover:text-black'
        }`}
      >
        {points.total >= 1000 ? `${(points.total / 1000).toFixed(1)}K` : Math.floor(points.total).toLocaleString()} pts
      </Link>
      {showVisionBalance && <VisionBalanceBar />}

      {/* Wallet state */}
      {mounted && authenticated && address ? (
        <div className="flex items-center gap-1.5">
          {!showVisionBalance && usdcBalance !== null && (
            <span
              className={`group/bal hidden sm:inline-flex items-center text-[12px] font-semibold font-mono tabular-nums tracking-tight ${
                isFaucetEnabled && usdcBalance === 0 ? 'cursor-pointer' : ''
              } ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}
              onClick={isFaucetEnabled && usdcBalance === 0 ? handleFaucet : undefined}
            >
              {isFaucetEnabled && usdcBalance === 0 ? (
                <>
                  <span className="group-hover/bal:hidden">
                    {usdcBalance.toFixed(2)}
                    <span className={`ml-0.5 font-medium ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>USDC</span>
                  </span>
                  <span className={`hidden group-hover/bal:inline text-[11px] font-semibold ${
                    faucetState === 'loading' ? 'text-zinc-400'
                      : faucetState === 'done' ? 'text-emerald-300'
                      : faucetState === 'error' ? 'text-red-300'
                      : 'text-emerald-300'
                  }`}>
                    {faucetState === 'loading' ? 'Minting...'
                      : faucetState === 'done' ? '1K USDC + gas sent'
                      : faucetState === 'error' ? 'Failed — retry'
                      : 'Get test USDC + gas'}
                  </span>
                </>
              ) : usdcBalance > 0 ? (
                <>
                  {usdcBalance < 0.01 ? '<0.01'
                    : usdcBalance >= 1_000_000 ? `${(usdcBalance / 1_000_000).toFixed(2)}M`
                    : usdcBalance >= 1_000 ? `${(usdcBalance / 1_000).toFixed(1)}K`
                    : usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className={`ml-0.5 font-medium ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>USDC</span>
                </>
              ) : (
                <a
                  href={`https://onramp.money/main/buy/?appId=1&coinCode=usdc&network=${process.env.NEXT_PUBLIC_ONRAMP_NETWORK || 'sonic'}&walletAddress=${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                    isDark
                      ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  {t('wallet.deposit')}
                </a>
              )}
            </span>
          )}
          <button
            onClick={handleLogout}
            className={`group inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-mono font-medium rounded-lg transition-all duration-200 fluid-press ${
              isDark
                ? 'bg-white/10 text-zinc-300 hover:bg-red-500/20 hover:text-red-300'
                : 'bg-zinc-100 text-zinc-600 hover:bg-red-50 hover:text-red-600'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 group-hover:bg-red-400 transition-colors" />
            <span className="group-hover:hidden">{truncateAddress(address)}</span>
            <span className="hidden group-hover:inline text-[11px] font-sans font-semibold">{t('actions.disconnect')}</span>
          </button>
        </div>
      ) : mounted && isWrongNetwork ? (
        <button
          onClick={() => switchChain({ chainId: indexL3.id })}
          disabled={isSwitching}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors disabled:opacity-50 fluid-press ${
            isDark
              ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          {isSwitching ? t('wallet.switching') : t('wallet.switch_network')}
        </button>
      ) : (
        <button
          onClick={handleLogin}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold tracking-[0.01em] rounded transition-all duration-200 fluid-press border ${
            isDark
              ? 'border-white/20 text-white hover:bg-white/10'
              : 'border-zinc-300 text-zinc-700 hover:border-zinc-900 hover:text-zinc-900'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {t('wallet.login')}
        </button>
      )}
    </>
  )
}
