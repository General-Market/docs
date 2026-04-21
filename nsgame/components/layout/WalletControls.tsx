'use client'

import { useWallet } from '@/hooks/useWallet'

interface WalletControlsProps {
  isDark?: boolean
}

// Placeholder. The previous EVM version rendered balance pills, a network
// switcher, and a MetaMask-style connect flow. The Solana integration
// agent will replace this with a @jup-ag/wallet-adapter modal trigger and
// USDC/SOL balance readouts. Until then we just surface connection state.

export function WalletControls({ isDark = false }: WalletControlsProps) {
  const { address, connected, connecting, disconnect, walletName } = useWallet()

  const tone = isDark
    ? 'border-zinc-700 text-zinc-300 hover:text-white'
    : 'border-zinc-300 text-zinc-700 hover:text-black'

  if (connecting) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded border ${tone}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
        ...
      </span>
    )
  }

  if (!connected || !address) {
    return (
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded border ${tone}`}
        onClick={() => {
          // Hook into the Unified Wallet Kit modal from the Solana provider.
          // The provider autoconnects, so this fallback only fires when the
          // user has never paired a wallet.
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('uwk-open-modal'))
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
        Connect
      </button>
    )
  }

  const short = `${address.slice(0, 4)}…${address.slice(-4)}`

  return (
    <button
      type="button"
      onClick={() => disconnect?.()}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded border ${tone}`}
      title={walletName ? `${walletName} — click to disconnect` : 'Disconnect'}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      {short}
    </button>
  )
}
