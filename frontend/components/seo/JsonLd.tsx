/**
 * JSON-LD Structured Data for SEO
 * Helps search engines understand the website content
 */

export function OrganizationJsonLd() {
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
      "The institutional-grade protocol for on-chain index products.",
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function WebsiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "General Market",
    url: "https://generalmarket.io",
    description:
      "The institutional-grade protocol for on-chain index products. Create, trade, and manage tokenized index products on-chain.",
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

export function SoftwareApplicationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "General Market",
    operatingSystem: "Web",
    applicationCategory: "FinanceApplication",
    description:
      "The institutional-grade protocol for on-chain index products. Create, trade, and manage tokenized index products.",
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

export function FAQJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is General Market?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "General Market is an institutional-grade protocol for on-chain index products. Create, trade, and manage tokenized index tracking products (ITPs) that track baskets of crypto assets, similar to how ETFs work in traditional finance.",
        },
      },
      {
        "@type": "Question",
        name: "What are Index Tracking Products (ITPs)?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "ITPs are tokenized index products that hold a fixed basket of crypto assets with defined weights. Their NAV (Net Asset Value) floats with the underlying asset prices, just like an ETF. You can create custom ITPs or trade existing ones.",
        },
      },
      {
        "@type": "Question",
        name: "How does lending work on General Market?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "General Market integrates with Morpho lending markets. You can deposit USDC to earn yield, or use your ITP shares as collateral to borrow against your positions.",
        },
      },
      {
        "@type": "Question",
        name: "What do I need to get started?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You need a Web3 wallet (like MetaMask) connected to the Index L3 network, and USDC tokens. You can then browse the Markets tab to buy existing ITPs or create your own custom index.",
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
