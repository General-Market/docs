import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { CSP_CONNECT_EXTRA } from "./lib/config";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const DOCS_URL = process.env.DOCS_URL || "https://nsgame.io";
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  staticPageGenerationTimeout: 180,
  pageExtensions: ["ts", "tsx", "md", "mdx"],
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
            value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://us-assets.i.posthog.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https: https://*.walletconnect.com https://station.jup.ag https://unified.jup.ag; connect-src 'self' https://cdn.jsdelivr.net wss://relay.walletconnect.com https://*.walletconnect.com https://*.reown.com https://rpc.walletconnect.org https://us.i.posthog.com https://us-assets.i.posthog.com https://station.jup.ag https://unified.jup.ag${CSP_CONNECT_EXTRA ? " " + CSP_CONNECT_EXTRA : ""}${isDev ? " http://localhost:* ws://localhost:*" : ""}; worker-src 'self' blob:; media-src 'self' blob:; frame-src https://www.youtube-nocookie.com https://www.youtube.com https://secure.walletconnect.com https://secure.walletconnect.org; frame-ancestors 'none'`,
          },
        ],
      },
    ];
  },
  // All backend/data-node/oracle/vision/rpc proxies are now handled by
  // catch-all route handlers under app/api/. Only locale routing and docs
  // proxy remain as rewrites.
  async rewrites() {
    return {
      beforeFiles: [
        // Docs proxy — must be before locale rewrite (set DOCS_URL when docs are wired up)
        { source: "/docs", destination: `${DOCS_URL}/` },
        { source: "/docs/:path*", destination: `${DOCS_URL}/:path*` },
        // Locale routing fallback
        { source: "/", destination: "/en" },
        {
          source: "/:path((?!en|ko|ja|zh|api|dn|rpc|_next|_vercel|docs|health)[^.]+)",
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
