import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { mdxComponents } from "@/components/mdx";
import { getArticle, getArticleSlugs } from "@/lib/learn/articles";
import { ArticleHeader } from "@/components/learn/ArticleHeader";
import { ArticleSidebar } from "@/components/learn/ArticleSidebar";
import { MobileArticleNav } from "@/components/learn/MobileArticleNav";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    const t = await getTranslations({ locale, namespace: "seo.pages.learn_article" });
    return { title: t("not_found") };
  }

  const { frontmatter } = article;

  return {
    title: frontmatter.title,
    description: frontmatter.description,
    keywords: frontmatter.keywords,
    alternates: {
      canonical: `/learn/${frontmatter.slug}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function LearnArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    notFound();
  }

  const { frontmatter, content, headings } = article;
  const t = await getTranslations({ locale, namespace: "pages.learn" });

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: frontmatter.title,
    description: frontmatter.description,
    author: {
      "@type": "Organization",
      name: "General Market",
      url: "https://www.generalmarket.io",
    },
    publisher: {
      "@type": "Organization",
      name: "General Market",
      url: "https://www.generalmarket.io",
      logo: {
        "@type": "ImageObject",
        url: "https://www.generalmarket.io/logo.svg",
      },
    },
    datePublished: frontmatter.date,
    dateModified: frontmatter.date,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://www.generalmarket.io/learn/${frontmatter.slug}`,
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: t("breadcrumb_home"),
        item: "https://www.generalmarket.io",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: t("breadcrumb_learn"),
        item: "https://www.generalmarket.io/learn",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: frontmatter.title,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <ArticleHeader frontmatter={frontmatter} />

      <MobileArticleNav headings={headings} />

      <div className="max-w-5xl mx-auto flex gap-12 px-6 py-12 md:py-16 w-full">
        <ArticleSidebar headings={headings} category={frontmatter.category} />

        <article className="max-w-3xl flex-1 min-w-0">
          <MDXRemote
            source={content}
            components={mdxComponents}
            options={{
              mdxOptions: {
                remarkPlugins: [remarkGfm],
                rehypePlugins: [rehypeHighlight],
              },
            }}
          />
        </article>
      </div>

      <Footer />
    </main>
  );
}
