import { listDocs } from '@/lib/content/loadDoc'
import { buildSectionMetadata } from '@/lib/content/metadata'
import { SectionIndex } from '@/components/docs/SectionIndex'
import { Footer } from '@/components/layout/Footer'

export function generateMetadata() {
  return buildSectionMetadata(
    'legal',
    'Legal',
    'The terms governing access to nsgame.org. Short, declarative, honest about what we do and do not control.',
  )
}

export default function LegalIndexPage() {
  const docs = listDocs('legal')
  return (
    <>
      <SectionIndex
        section="legal"
        title="Legal"
        description="The website is something we control. The protocol is something we don't. These pages mark the line."
        docs={docs}
        groups={[
          {
            heading: 'Core',
            slugs: ['terms-of-use', 'privacy-policy', 'disclaimer'],
          },
          {
            heading: 'Conduct',
            slugs: ['acceptable-use-policy', 'risk-disclosure', 'age-gate'],
          },
          {
            heading: 'Boundaries',
            slugs: ['restricted-territories', 'cookie-policy', 'dmca-policy'],
          },
        ]}
      />
      <Footer />
    </>
  )
}
