import { listDocs } from '@/lib/content/loadDoc'
import { buildSectionMetadata } from '@/lib/content/metadata'
import { SectionIndex } from '@/components/docs/SectionIndex'

export function generateMetadata() {
  return buildSectionMetadata(
    'brand',
    'Brand',
    'About nsgame, and the kit if you need to write about it.',
  )
}

export default function BrandIndexPage() {
  const docs = listDocs('brand')
  return (
    <SectionIndex
      section="brand"
      title="Brand"
      description="Who we are, what we are not, and how to draw the logo if you must."
      docs={docs}
    />
  )
}
