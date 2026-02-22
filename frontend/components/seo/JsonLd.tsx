/**
 * JSON-LD Structured Data for SEO
 * Helps search engines understand the website content
 *
 * All user-facing strings are passed as props from server components
 * that have access to getTranslations().
 */

import type { ItpSummary } from '@/lib/api/server-data'

export function OrganizationJsonLd({ description }: { description?: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "General Market",
    url: "https://generalmarket.io",
    logo: "https://generalmarket.io/logo.svg",
    sameAs: [
      "https://x.com/otc_max",
    ],
    description:
      description ?? "The institutional-grade protocol for on-chain index products.",
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function WebsiteJsonLd({ description }: { description?: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "General Market",
    url: "https://generalmarket.io",
    description:
      description ?? "The institutional-grade protocol for on-chain index products. Create, trade, and manage tokenized index products on-chain.",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://generalmarket.io/?search={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function SoftwareApplicationJsonLd({ description }: { description?: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "General Market",
    operatingSystem: "Web",
    applicationCategory: "FinanceApplication",
    description:
      description ?? "The institutional-grade protocol for on-chain index products. Create, trade, and manage tokenized index products.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Organization",
      name: "General Market",
      url: "https://generalmarket.io",
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export interface FAQItem {
  question: string
  answer: string
}

export function FAQJsonLd({ items }: { items?: FAQItem[] }) {
  const defaultItems: FAQItem[] = [
    {
      question: "What is General Market?",
      answer: "General Market is an institutional-grade protocol for on-chain index products. Create, trade, and manage tokenized index tracking products (ITPs) that track baskets of crypto assets, similar to how ETFs work in traditional finance.",
    },
    {
      question: "What are Index Tracking Products (ITPs)?",
      answer: "ITPs are tokenized index products that hold a fixed basket of crypto assets with defined weights. Their NAV (Net Asset Value) floats with the underlying asset prices, just like an ETF. You can create custom ITPs or trade existing ones.",
    },
    {
      question: "How does lending work on General Market?",
      answer: "General Market integrates with Morpho lending markets. You can deposit USDC to earn yield, or use your ITP shares as collateral to borrow against your positions.",
    },
    {
      question: "What do I need to get started?",
      answer: "You need a Web3 wallet (like MetaMask) connected to the Index L3 network, and USDC tokens. You can then browse the Markets tab to buy existing ITPs or create your own custom index.",
    },
  ]

  const faqItems = items ?? defaultItems

  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function InvestmentFundJsonLd({ itps, descriptionTemplate }: { itps: ItpSummary[]; descriptionTemplate?: (itp: ItpSummary) => string }) {
  if (itps.length === 0) return null

  const defaultTemplate = (itp: ItpSummary) =>
    `${itp.name} \u2014 on-chain index tracking product with ${itp.assetCount} crypto assets. NAV: $${itp.nav.toFixed(4)}.`

  const getDescription = descriptionTemplate ?? defaultTemplate

  const data = itps.map((itp) => ({
    "@context": "https://schema.org",
    "@type": "InvestmentFund",
    name: itp.name,
    tickerSymbol: itp.symbol,
    description: getDescription(itp),
    url: `https://generalmarket.io/itp/${itp.itpId}`,
    provider: {
      "@type": "Organization",
      name: "General Market",
      url: "https://generalmarket.io",
    },
  }))

  return (
    <>
      {data.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }}
        />
      ))}
    </>
  )
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
