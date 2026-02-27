import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { mdxComponents } from "@/components/mdx";
import { getArticle, getArticleSlugs } from "@/lib/learn/articles";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    return { title: "Article Not Found" };
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
    openGraph: {
      title: frontmatter.title,
      description: frontmatter.description,
      url: `https://www.generalmarket.io/learn/${frontmatter.slug}`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: frontmatter.title,
      description: frontmatter.description,
    },
  };
}

export default async function LearnArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    notFound();
  }

  const { frontmatter, content } = article;

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
        name: "Home",
        item: "https://www.generalmarket.io",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Learn",
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

      {/* Hero-band article header */}
      <div className="hero-band">
        <div className="hero-band-inner">
          <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-3">
            {frontmatter.category}
          </div>
          <h1 className="text-[28px] md:text-[42px] font-black tracking-[-0.03em] text-black leading-[1.1] mb-3">
            {frontmatter.title}
          </h1>
          <div className="text-[14px] text-text-secondary">
            {frontmatter.readingTime} &middot; {frontmatter.date}
          </div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-12 md:py-16 w-full">
        {/* MDX Content */}
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

      <Footer />
    </main>
  );
}
