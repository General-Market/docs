import { listDocs } from '@/lib/content/loadDoc'
import { buildSectionMetadata } from '@/lib/content/metadata'
import { SectionIndex } from '@/components/docs/SectionIndex'

export function generateMetadata() {
  return buildSectionMetadata(
    'trust',
    'Trust',
    'Decentralization, the oracle network, the data sources, the audit roadmap, the token. The arguments and their absences.',
  )
}

export default function TrustIndexPage() {
  const docs = listDocs('trust')
  return (
    <SectionIndex
      section="trust"
      title="Trust"
      description="No operator entity. No KYC. No house. The chain is the ledger. The DAO is in formation. The pages below are the rest of the answer."
      docs={docs}
      groups={[
        {
          heading: 'Governance',
          slugs: ['decentralization-and-dao', 'token-status', 'audit-and-mainnet-roadmap'],
        },
        {
          heading: 'Resolution',
          slugs: ['goldilock-oracle-network', 'data-source-methodology', 'market-integrity'],
        },
        {
          heading: 'Subjects',
          slugs: ['subject-removal-policy'],
        },
      ]}
    />
  )
}
