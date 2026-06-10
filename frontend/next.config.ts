import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { CSP_CONNECT_EXTRA } from "./lib/config";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";

/* ── Docs redirect map (docs/docs-rebuild/spec.md) ──────────────────────────
   The docs were rebuilt as five sections under /docs/{section}/{slug}. Every
   old URL gets a permanent redirect to its new home. Two retired prefixes
   carried the same page tree across eras: /docs/blocks (recent) and
   /docs/vision (pre-blocks). /docs/vision is a REAL section again, so it gets
   only the legacy sub-trees (concepts/, api/, bots/, …) — never a catch-all,
   which would shadow the live pages. Specific maps first, catch-alls last. */

// old slug (relative to the retired prefix) → new absolute destination
const DOCS_PAGE_MOVES: Record<string, string> = {
  "introduction": "/docs/vision/how-vision-works",
  "getting-started": "/docs/vision/first-predictions",
  "examples": "/docs/bots/quickstart",
  "concepts/blocks": "/docs/vision/blocks-and-ticks",
  "concepts/ticks": "/docs/vision/blocks-and-ticks",
  "concepts/bitmaps": "/docs/vision/predictions-and-bitmaps",
  "concepts/fees": "/docs/vision/fees",
  "concepts/sources": "/docs/vision/markets",
  "concepts/resolution-types": "/docs/vision/markets",
  "concepts/balance-proofs": "/docs/vision/your-money",
  "bots/development": "/docs/bots/strategies",
  "api/overview": "/docs/developers/overview",
  "api/blocks": "/docs/developers/vision-api/batches",
  "api/state": "/docs/developers/vision-api/batches",
  "api/bitmap": "/docs/developers/vision-api/bitmap",
  "api/balance": "/docs/developers/vision-api/players",
  "api/leaderboard": "/docs/developers/vision-api/stats",
  "api/snapshot": "/docs/developers/vision-api/discovery",
  "api/ticks": "/docs/developers/vision-api/history",
  "guides/adding-sources": "/docs/developers/architecture",
  "reference/contracts": "/docs/developers/contracts",
  "reference/error-codes": "/docs/developers/contracts",
  "reference/contract-addresses": "/docs/get-started/network",
  "reference/glossary": "/docs/get-started/glossary",
};

type Redirect = { source: string; destination: string; permanent: boolean };

function docsRedirects(): Redirect[] {
  const r = (source: string, destination: string): Redirect => ({ source, destination, permanent: true });
  const rules: Redirect[] = [];
  const RETIRED_PREFIXES = ["/docs/blocks", "/docs/vision"];

  // 1 · specific page moves under both retired prefixes
  for (const prefix of RETIRED_PREFIXES) {
    for (const [old, dest] of Object.entries(DOCS_PAGE_MOVES)) {
      rules.push(r(`${prefix}/${old}`, dest));
    }
  }
  // /docs/vision/risks is a live page now; only the blocks twin redirects.
  rules.push(r("/docs/blocks/risks", "/docs/vision/risks"));

  // 2 · old Index MDX slugs → the new flat Index section + developers pages.
  // No /docs/index/:path* catch-all — the section is live; only the legacy
  // sub-trees (concepts/, guides/, api/, architecture/, reference/) redirect.
  rules.push(
    r("/docs/index/introduction", "/docs/index/what-is-a-dtf"),
    r("/docs/index/getting-started", "/docs/index/buy-and-sell"),
    r("/docs/index/concepts/itps", "/docs/index/what-is-a-dtf"),
    r("/docs/index/concepts/lending", "/docs/index/lending"),
    r("/docs/index/concepts/order-lifecycle", "/docs/index/order-lifecycle"),
    r("/docs/index/concepts/:path*", "/docs/index/what-is-a-dtf"),
    r("/docs/index/guides/buy-sell", "/docs/index/buy-and-sell"),
    r("/docs/index/guides/create-itp", "/docs/index/create-a-dtf"),
    r("/docs/index/guides/rebalancing", "/docs/index/rebalancing"),
    r("/docs/index/guides/risks", "/docs/index/risks"),
    r("/docs/index/guides/settlement", "/docs/index/settlement-and-bridge"),
    r("/docs/index/guides/backtesting", "/docs/developers/index-api/portfolio"),
    r("/docs/index/guides/:path*", "/docs/index/buy-and-sell"),
    r("/docs/index/api/overview", "/docs/developers/overview"),
    r("/docs/index/api/itps", "/docs/developers/index-api/markets"),
    r("/docs/index/api/prices", "/docs/developers/index-api/markets"),
    r("/docs/index/api/portfolio", "/docs/developers/index-api/portfolio"),
    r("/docs/index/api/simulation", "/docs/developers/index-api/portfolio"),
    r("/docs/index/api/morpho", "/docs/developers/index-api/lending"),
    r("/docs/index/api/infrastructure", "/docs/developers/architecture"),
    r("/docs/index/api/:path*", "/docs/developers/overview"),
    r("/docs/index/architecture/bridge", "/docs/index/settlement-and-bridge"),
    r("/docs/index/architecture/l3-chain", "/docs/get-started/network"),
    r("/docs/index/architecture/contracts", "/docs/developers/contracts"),
    r("/docs/index/architecture/:path*", "/docs/developers/architecture"),
    r("/docs/index/reference/contract-addresses", "/docs/get-started/network"),
    r("/docs/index/reference/error-codes", "/docs/developers/contracts"),
    r("/docs/index/reference/glossary", "/docs/get-started/glossary"),
    r("/docs/index/reference/:path*", "/docs/index"),
  );

  // 3 · legacy sub-tree catch-alls under both retired prefixes
  for (const prefix of RETIRED_PREFIXES) {
    rules.push(
      r(`${prefix}/bots/:path*`, "/docs/bots/:path*"),
      r(`${prefix}/api/:path*`, "/docs/developers/overview"),
      r(`${prefix}/architecture/:path*`, "/docs/developers/architecture"),
      r(`${prefix}/reference/:path*`, "/docs/developers/contracts"),
      r(`${prefix}/concepts/:path*`, "/docs/vision"),
      r(`${prefix}/guides/:path*`, "/docs/vision"),
    );
  }

  // 4 · final catch-all — only for the fully retired blocks prefix
  rules.push(r("/docs/blocks/:path*", "/docs/vision"));

  return rules;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  staticPageGenerationTimeout: 180,
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Include data files in serverless function bundles — fs.readFile paths
  // aren't resolved by nft tracing, so Vercel omits them without this.
  outputFileTracingIncludes: {
    "/api/itp-enrichment": ["./data/founders-lookup.json", "./data/symbol-map.json", "./public/coin-map.json", "./public/deployed-assets.json"],
    "/\\[locale\\]/itp/\\[itpId\\]": ["./data/founders-lookup.json", "./data/symbol-map.json", "./public/coin-map.json", "./public/deployed-assets.json"],
    "/api/config": ["./lib/itp-id-names.json", "./lib/config/blacklisted-itps.json", "./data/sources-display.json"],
  },
  // Webpack config to handle WalletConnect's pino-pretty optional dependency
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
      "@solana/kit": false,
      "axios": false,
      "zod": false,
      "@react-native-async-storage/async-storage": false,
      "@coinbase/wallet-sdk": false,
      "@gemini-wallet/core": false,
    };
    return config;
  },
  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://us-assets.i.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: https://*.walletconnect.com; connect-src 'self' blob: https://cdn.jsdelivr.net wss://relay.walletconnect.com https://*.walletconnect.com https://*.reown.com https://rpc.walletconnect.org https://us.i.posthog.com https://us-assets.i.posthog.com${CSP_CONNECT_EXTRA ? " " + CSP_CONNECT_EXTRA : ""}${isDev ? " http://localhost:* ws://localhost:*" : ""}; worker-src 'self' blob:; media-src 'self' blob:; frame-src https://www.youtube-nocookie.com https://www.youtube.com https://secure.walletconnect.com https://secure.walletconnect.org; frame-ancestors 'none'`,
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // The docs are now the five-section handbook under /docs/{section}.
      // Every old /docs/blocks/* and old /docs/index/* (and pre-blocks
      // /docs/vision/*) URL redirects permanently to its new home.
      ...docsRedirects(),
      // Pre-seed room URLs collapsed to /room. The slug was a multi-tenant
      // artifact we no longer need; redirect any old magic links.
      { source: '/room/pre-seed', destination: '/room', permanent: true },
      { source: '/room/pre-seed/:path*', destination: '/room/:path*', permanent: true },
    ]
  },
  // All backend/data-node/oracle/vision/rpc proxies are now handled by
  // catch-all route handlers under app/api/. Docs are now served natively
  // from app/docs (was previously proxied to Mintlify at docs.generalmarket.io).
  async rewrites() {
    return {
      beforeFiles: [
        // Static-HTML case studies live under public/. Next.js doesn't serve
        // a directory index for them by default — explicitly rewrite the
        // canonical URL to the file. The locale rewrite below excludes the
        // case-studies prefix so the trailing-slash and .html forms also resolve.
        { source: "/case-studies/:slug", destination: "/case-studies/:slug/index.html" },
        // Locale routing fallback
        { source: "/", destination: "/en" },
        {
          source: "/:path((?!en|ko|ja|zh|api|dn|rpc|_next|_vercel|docs|health|room|pitchdeck|case-studies)[^.]+)",
          destination: "/en/:path",
        },
      ],
      afterFiles: [
        // Wallet extensions cache chain RPC URLs. If the wallet stored "/rpc"
        // from a previous session, it will keep hitting /rpc directly.
        // Proxy to the actual route handler so it never gets HTML/RSC back.
        { source: "/rpc", destination: "/api/rpc" },
      ],
      fallback: [],
    };
  },
};

export default withNextIntl(nextConfig);
