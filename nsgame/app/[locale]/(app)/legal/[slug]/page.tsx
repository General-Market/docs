import { notFound } from 'next/navigation'
import { listDocSlugs, loadDoc } from '@/lib/content/loadDoc'
import { buildDocMetadata } from '@/lib/content/metadata'
import { DocPage } from '@/components/docs/DocPage'
import { Footer } from '@/components/layout/Footer'

export const dynamicParams = false

export function generateStaticParams() {
  return listDocSlugs('legal').map(slug => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const doc = loadDoc('legal', slug)
  if (!doc) return {}
  return buildDocMetadata('legal', doc.frontmatter)
}

export default async function LegalDocPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const doc = loadDoc('legal', slug)
  if (!doc) notFound()

  return (
    <>
      <DocPage
        doc={doc}
        section="legal"
        sectionLabel="Legal"
        sectionHref="/legal"
      />
      <Footer />
    </>
  )
}
