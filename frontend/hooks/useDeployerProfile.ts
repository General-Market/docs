'use client'

import { useCallback, useState } from 'react'

interface DeployerProfile {
  displayName: string
  websiteUrl: string
}

export function useDeployerProfile(_address: `0x${string}`) {
  const [profile] = useState<DeployerProfile | null>(null)

  const refetch = useCallback(() => {
    // Stub — deployer profile not yet implemented on-chain
  }, [])

  return { profile, refetch }
}
