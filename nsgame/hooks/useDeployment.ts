'use client'

import useSWR from 'swr'

interface DeploymentConfig {
  chainId: number
  contracts: Record<string, string>
  accounts?: Record<string, string>
  whitelistedVaults?: string[]
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

/**
 * Runtime deployment config — fetched once, cached 5 minutes.
 * Replaces all NEXT_PUBLIC_*_ADDRESS env vars with runtime-loaded addresses.
 *
 * Use getAddress('ContractName') to retrieve a contract address.
 * For the IssuerRegistry → OracleRegistry rename, getAddress handles the fallback.
 */
export function useDeployment() {
  const { data, error, isLoading } = useSWR<DeploymentConfig>(
    '/api/deployment',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000, // 5 min — matches server cache
    },
  )

  const getAddress = (name: string): `0x${string}` => {
    const addr = data?.contracts?.[name]
      ?? (name === 'IssuerRegistry' ? data?.contracts?.['OracleRegistry'] : undefined)
    return (addr ?? '0x0000000000000000000000000000000000000000') as `0x${string}`
  }

  const whitelistedVaults: `0x${string}`[] = (data?.whitelistedVaults ?? [])
    .map(a => a.toLowerCase() as `0x${string}`)

  return {
    deployment: data ?? null,
    getAddress,
    whitelistedVaults,
    isLoading,
    error: error ?? null,
  }
}
