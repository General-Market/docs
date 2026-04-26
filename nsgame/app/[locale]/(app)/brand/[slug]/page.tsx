import { notFound } from 'next/navigation'
import { listDocSlugs, loadDoc } from '@/lib/content/loadDoc'
import { buildDocMetadata } from '@/lib/content/metadata'
import { DocPage } from '@/components/docs/DocPage'

export const dynamicParams = false

export function generateStaticParams() {
  return listDocSlugs('brand').map(slug => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const doc = loadDoc('brand', slug)
  if (!doc) return {}
  return buildDocMetadata('brand', doc.frontmatter)
}

export default async function BrandDocPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const doc = loadDoc('brand', slug)
  if (!doc) notFound()

  return (
    <DocPage
      doc={doc}
      section="brand"
      sectionLabel="Brand"
      sectionHref="/brand"
    />
  )
}
