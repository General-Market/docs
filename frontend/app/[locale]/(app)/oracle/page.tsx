import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/AppShell'
import OracleBalancesClient from './OracleBalancesClient'

export const metadata: Metadata = {
  title: 'Oracle balances — General Market',
  description: 'Hourly native-gas balance history for the oracle wallet roster on L3 and Sonic testnet.',
  alternates: { canonical: '/oracle' },
}

export default function OraclePage() {
  return (
    <AppShell>
      <OracleBalancesClient />
    </AppShell>
  )
}
