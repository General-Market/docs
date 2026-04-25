/**
 * JSON-LD Structured Data for SEO
 * Helps search engines understand the website content
 *
 * All user-facing strings MUST be passed as props from server components
 * that have access to getTranslations(). No hardcoded English fallbacks.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nsgame.io'

export function OrganizationJsonLd({ description }: { description: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "nsgame",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/logo.svg`,
    },
    description,
  }

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function WebsiteJsonLd({ description }: { description: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "nsgame",
    url: SITE_URL,
    description,
  }

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function SoftwareApplicationJsonLd({ description }: { description: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "nsgame",
    operatingSystem: "Web",
    applicationCategory: "FinanceApplication",
    description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Organization",
      name: "nsgame",
      url: SITE_URL,
    },
  }

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
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
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
