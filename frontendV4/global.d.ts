/**
 * Global type declarations for browser APIs
 */

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (event: string, callback: (...args: unknown[]) => void) => void
  removeListener?: (event: string, callback: (...args: unknown[]) => void) => void
  isMetaMask?: boolean
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

export {}
