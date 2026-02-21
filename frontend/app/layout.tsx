import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClientProviders } from "./client-providers";
import {
  OrganizationJsonLd,
  WebsiteJsonLd,
  SoftwareApplicationJsonLd,
  FAQJsonLd,
} from "@/components/seo/JsonLd";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090B",
};

export const metadata: Metadata = {
  title: {
    default: "General Market",
    template: "%s | General Market",
  },
  description:
    "The institutional-grade protocol for on-chain index products.",
  keywords: [
    "index funds",
    "ETF",
    "institutional",
    "on-chain",
    "crypto trading",
    "DeFi",
    "autonomous capital markets",
    "Base L2",
  ],
  authors: [{ name: "General Market", url: "https://x.com/otc_max" }],
  creator: "General Market",
  publisher: "General Market",
  metadataBase: new URL("https://generalmarket.io"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://generalmarket.io",
    siteName: "General Market",
    title: "General Market",
    description:
      "The institutional-grade protocol for on-chain index products.",
  },
  twitter: {
    card: "summary_large_image",
    title: "General Market",
    description:
      "The institutional-grade protocol for on-chain index products.",
    creator: "@otc_max",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="canonical" href="https://generalmarket.io" />
        <OrganizationJsonLd />
        <WebsiteJsonLd />
        <SoftwareApplicationJsonLd />
        <FAQJsonLd />
      </head>
      <body className="bg-page text-text-inverse font-sans antialiased">
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
