'use client'

import { useState, type ReactNode } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { indexL3 } from '@/lib/wagmi'

interface WalletActionButtonProps {
  onClick: () => void
  children: ReactNode
  className?: string
  disabled?: boolean
}

/**
 * Wrapper for action buttons (Buy, Sell, Rebalance, Borrow, etc.)
 * When wallet is NOT connected: shows "Connect Wallet" on hover and triggers connection on click.
 * When wallet IS connected: behaves as a normal button.
 *
 * Styling is applied by the caller via className (use Button variants: buy, sell, default, outline).
 */
export function WalletActionButton({ onClick, children, className, disabled }: WalletActionButtonProps) {
  const { isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const [hovered, setHovered] = useState(false)

  const injectedConnector = connectors.find(c => c.id === 'injected')

  const handleClick = async () => {
    if (isConnected) {
      onClick()
      return
    }
    if (!injectedConnector) return
    const chainIdHex = `0x${indexL3.id.toString(16)}`
    const provider = (window as any).ethereum
    if (provider) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainIdHex,
            chainName: indexL3.name,
            nativeCurrency: indexL3.nativeCurrency,
            rpcUrls: [indexL3.rpcUrls.default.http[0]],
          }],
        })
      } catch { /* chain may exist */ }
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        })
      } catch { /* user rejected */ }
    }
    connect({ connector: injectedConnector, chainId: indexL3.id })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isConnected ? disabled : isPending}
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!isConnected && hovered ? 'Connect Wallet' : children}
    </button>
  )
}
