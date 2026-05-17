import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { CSP_CONNECT_EXTRA } from "./lib/config";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";

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
      // Vision was the protocol's earlier identity; the product is now Blocks.
      // The bytecode remembers, but the URLs do not.
      { source: '/docs/vision', destination: '/docs/blocks/introduction', permanent: true },
      { source: '/docs/vision/:path*', destination: '/docs/blocks/:path*', permanent: true },
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
        // Locale routing fallback
        { source: "/", destination: "/en" },
        {
          source: "/:path((?!en|ko|ja|zh|api|dn|rpc|_next|_vercel|docs|health|room|pitchdeck)[^.]+)",
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
