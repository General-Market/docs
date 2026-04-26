import { notFound } from 'next/navigation'
import { listDocSlugs, loadDoc } from '@/lib/content/loadDoc'
import { buildDocMetadata } from '@/lib/content/metadata'
import { DocPage } from '@/components/docs/DocPage'

export const dynamicParams = false

export function generateStaticParams() {
  return listDocSlugs('product').map(slug => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const doc = loadDoc('product', slug)
  if (!doc) return {}
  return buildDocMetadata('product', doc.frontmatter)
}

export default async function ProductDocPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const doc = loadDoc('product', slug)
  if (!doc) notFound()

  return (
    <DocPage
      doc={doc}
      section="product"
      sectionLabel="Product"
      sectionHref="/product"
    />
  )
}
