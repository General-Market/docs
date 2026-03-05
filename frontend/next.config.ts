import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
const DATA_NODE_URL = process.env.DATA_NODE_URL || "http://localhost:8200";
const VISION_API_URL = process.env.NEXT_PUBLIC_VISION_API_URL || "http://localhost:10001";
const DOCS_URL = process.env.DOCS_URL || "https://generalmarket.mintlify.dev";
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
            value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://us-assets.i.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: https://*.walletconnect.com; connect-src 'self' https://cdn.jsdelivr.net http://142.132.164.24 http://116.203.156.98 wss://relay.walletconnect.com https://*.walletconnect.com https://*.reown.com https://rpc.walletconnect.org https://us.i.posthog.com https://us-assets.i.posthog.com${isDev ? " http://localhost:* ws://localhost:*" : ""}; frame-src https://www.youtube-nocookie.com https://www.youtube.com https://secure.walletconnect.com https://secure.walletconnect.org; frame-ancestors 'none'`,
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/leaderboard",
        destination: `${BACKEND_URL}/api/leaderboard`,
      },
      {
        source: "/api/leaderboard/:path*",
        destination: `${BACKEND_URL}/api/leaderboard/:path*`,
      },
      {
        source: "/api/bets/:path*",
        destination: `${BACKEND_URL}/api/bets/:path*`,
      },
      {
        source: "/api/agents/:path*",
        destination: `${BACKEND_URL}/api/agents/:path*`,
      },
      {
        source: "/api/resolutions/:path*",
        destination: `${BACKEND_URL}/api/resolutions/:path*`,
      },
      {
        source: "/api/telegram/:path*",
        destination: `${BACKEND_URL}/api/telegram/:path*`,
      },
      {
        source: "/api/sse/:path*",
        destination: `${BACKEND_URL}/api/sse/:path*`,
      },
      {
        source: "/api/keepers/:path*",
        destination: `${BACKEND_URL}/api/keepers/:path*`,
      },
      {
        source: "/api/markets/:path*",
        destination: `${BACKEND_URL}/api/markets/:path*`,
      },
      {
        source: "/api/market-prices",
        destination: `${BACKEND_URL}/api/market-prices`,
      },
      {
        source: "/api/market-stats/:path*",
        destination: `${BACKEND_URL}/api/market-stats/:path*`,
      },
      {
        source: "/api/categories",
        destination: `${BACKEND_URL}/api/categories`,
      },
      {
        source: "/api/snapshots/:path*",
        destination: `${BACKEND_URL}/api/snapshots/:path*`,
      },
      {
        source: "/api/vision/snapshot/meta",
        destination: `${DATA_NODE_URL}/snapshot/meta`,
      },
      {
        source: "/api/vision/snapshot",
        destination: `${DATA_NODE_URL}/snapshot`,
      },
      {
        source: "/api/vision/:path*",
        destination: `${VISION_API_URL}/vision/:path*`,
      },
      {
        source: "/health",
        destination: `${BACKEND_URL}/health`,
      },
      // Mintlify docs proxy
      {
        source: "/docs",
        destination: `${DOCS_URL}/docs`,
      },
      {
        source: "/docs/:path*",
        destination: `${DOCS_URL}/docs/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
