import { createConfig, http, fallback } from 'wagmi'
import { type Chain } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

// RPC URL from environment - defaults to localhost for local dev
const envRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8546'

// Chain definition — frontend connects to Arbitrum only; L3 bridging is backend-side
export const indexL3: Chain = {
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 421611337,
  name: 'Index Arbitrum',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [envRpcUrl] },
    public: { http: [envRpcUrl] },
  },
  testnet: true,
}

// RPC configuration with fallback support
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8546'
const fallbackRpcUrl = process.env.NEXT_PUBLIC_RPC_FALLBACK_URL

// WalletConnect project ID - required for WalletConnect to work
const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID
const isWcConfigured = wcProjectId && wcProjectId !== 'your_walletconnect_project_id_here'

// Build transport with fallback if configured
const chainTransport = fallbackRpcUrl
  ? fallback([
      http(rpcUrl, {
        timeout: 5_000, // 5 second timeout per Dev Notes
        retryCount: 2,
        retryDelay: 1_000
      }),
      http(fallbackRpcUrl, {
        timeout: 5_000,
        retryCount: 2,
        retryDelay: 1_000
      })
    ])
  : http(rpcUrl, {
      timeout: 10_000,
      retryCount: 3,
      retryDelay: 1_000
    })

// Lazy initialization function for SSR safety
// Config is created on first call (client-side only)
let config: ReturnType<typeof createConfig> | null = null

export function getWagmiConfig() {
  if (!config) {
    config = createConfig({
      chains: [indexL3],
      connectors: [
        injected(), // MetaMask, Coinbase Wallet, etc.
        ...(isWcConfigured ? [walletConnect({ projectId: wcProjectId! })] : [])
      ],
      transports: {
        [indexL3.id]: chainTransport
      },
    })
  }
  return config
}

// wagmiConfig removed — use getWagmiConfig() for SSR safety

// Export the active chain for use in components
export const activeChain = indexL3
export const activeChainId = indexL3.id
