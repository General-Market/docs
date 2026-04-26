import { listDocs } from '@/lib/content/loadDoc'
import { buildSectionMetadata } from '@/lib/content/metadata'
import { SectionIndex } from '@/components/docs/SectionIndex'

export function generateMetadata() {
  return buildSectionMetadata(
    'product',
    'Product',
    'How rounds open, lock, and resolve. How the pot splits. What you pay. What you get back.',
  )
}

export default function ProductIndexPage() {
  const docs = listDocs('product')
  return (
    <SectionIndex
      section="product"
      title="Product"
      description="Twenty-five fights, two boards, one pool per side. The mechanics, in writing."
      docs={docs}
      groups={[
        {
          heading: 'Mechanics',
          slugs: ['how-it-works', 'round-mechanics', 'parimutuel-methodology'],
        },
        {
          heading: 'Markets',
          slugs: ['market-rules', 'resolution-sources', 'settlement-rules'],
        },
        {
          heading: 'Money',
          slugs: ['fee-schedule', 'refund-policy'],
        },
      ]}
    />
  )
}
