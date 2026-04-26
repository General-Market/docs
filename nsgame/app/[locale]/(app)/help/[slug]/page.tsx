import { notFound } from 'next/navigation'
import { listDocSlugs, loadDoc } from '@/lib/content/loadDoc'
import { buildDocMetadata } from '@/lib/content/metadata'
import { DocPage } from '@/components/docs/DocPage'
import { Footer } from '@/components/layout/Footer'

export const dynamicParams = false

export function generateStaticParams() {
  // Exclude help-center-home — that one is rendered as the /help index.
  return listDocSlugs('help')
    .filter(slug => slug !== 'help-center-home')
    .map(slug => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const doc = loadDoc('help', slug)
  if (!doc) return {}
  return buildDocMetadata('help', doc.frontmatter)
}

export default async function HelpDocPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (slug === 'help-center-home') notFound()
  const doc = loadDoc('help', slug)
  if (!doc) notFound()

  return (
    <>
      <DocPage
        doc={doc}
        section="help"
        sectionLabel="Help Center"
        sectionHref="/help"
      />
      <Footer />
    </>
  )
}
