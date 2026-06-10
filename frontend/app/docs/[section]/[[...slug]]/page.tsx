import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HandbookArticle, resolveSlug } from "../../_shared";
import {
  HANDBOOK_SECTIONS,
  handbookLib,
  isHandbookSection,
  sectionTitle,
} from "@/lib/handbook";

type Params = { section: string; slug?: string[] };

/** Every section root plus every page, statically generated at build time. */
export function generateStaticParams(): Params[] {
  const out: Params[] = [];
  for (const { slug: section } of HANDBOOK_SECTIONS) {
    out.push({ section, slug: undefined });
    for (const doc of handbookLib(section).listDocs()) {
      out.push({ section, slug: doc.slug.split("/") });
    }
  }
  return out;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { section, slug } = await params;
  if (!isHandbookSection(section)) return {};
  const resolved = resolveSlug(section, slug);
  const doc = resolved ? handbookLib(section).loadDoc(resolved) : null;
  if (!doc) return { title: `${sectionTitle(section)} · General Market Docs` };
  return {
    title: `${doc.title} · General Market Docs`,
    description: doc.description,
    alternates: { canonical: `/docs/${section}/${doc.slug}` },
  };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { section, slug } = await params;
  if (!isHandbookSection(section)) notFound();
  return <HandbookArticle section={section} slugParts={slug} />;
}
