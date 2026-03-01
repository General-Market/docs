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
    url: "https://www.generalmarket.io",
    logo: {
      "@type": "ImageObject",
      url: "https://www.generalmarket.io/logo.svg",
    },
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
    url: "https://www.generalmarket.io",
    description:
      description ?? "The institutional-grade protocol for on-chain index products. Create, trade, and manage tokenized index products on-chain.",
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
      url: "https://www.generalmarket.io",
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function FinancialProductJsonLd({ itps, descriptionTemplate }: { itps: ItpSummary[]; descriptionTemplate?: (itp: ItpSummary) => string }) {
  if (itps.length === 0) return null

  const defaultTemplate = (itp: ItpSummary) =>
    `${itp.name} \u2014 on-chain index tracking product with ${itp.assetCount} crypto assets. NAV: $${itp.nav.toFixed(4)}.`

  const getDescription = descriptionTemplate ?? defaultTemplate

  const data = itps.map((itp) => ({
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    "category": "Index Fund",
    name: itp.name,
    tickerSymbol: itp.symbol,
    description: getDescription(itp),
    url: `https://www.generalmarket.io/itp/${itp.itpId}`,
    provider: {
      "@type": "Organization",
      name: "General Market",
      url: "https://www.generalmarket.io",
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
      ...(i < items.length - 1 ? { item: item.url } : {}),
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
