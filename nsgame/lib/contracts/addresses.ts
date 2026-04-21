// Stub module kept alive for the protected hooks (useBetHistory,
// useBilateralBets, useResolution, useResolutionSignatures). The EVM
// addresses file was burned with the rest of `lib/contracts/`; the
// Solana-integration agent will replace this scaffold with a real
// Solana program registry.

export function getBackendUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    'http://localhost:3001'
  )
}

// USDC decimals on Solana. Kept here so `lib/utils/formatters.ts` and any
// migrating consumer can import a single constant instead of hardcoding.
export const COLLATERAL_DECIMALS = 6
