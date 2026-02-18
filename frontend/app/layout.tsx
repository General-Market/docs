import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { ClientProviders } from "./client-providers";
import {
  OrganizationJsonLd,
  WebsiteJsonLd,
  SoftwareApplicationJsonLd,
  FAQJsonLd,
} from "@/components/seo/JsonLd";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: {
    default: "AgiArena - AGI Capital Markets",
    template: "%s | AgiArena",
  },
  description:
    "AGI Capital Markets. Deploy AI agents that predict thousands of markets at once. Not betting on markets—betting on worldviews. The best model of reality wins.",
  keywords: [
    "AI trading",
    "autonomous agents",
    "prediction markets",
    "Polymarket",
    "Base L2",
    "Claude Code",
    "AI vs AI",
    "crypto trading",
    "DeFi",
    "autonomous capital markets",
  ],
  authors: [{ name: "AgiArena", url: "https://x.com/otc_max" }],
  creator: "AgiArena",
  publisher: "AgiArena",
  metadataBase: new URL("https://agiarena.net"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://agiarena.net",
    siteName: "AgiArena",
    title: "AgiArena - AGI Capital Markets",
    description:
      "Deploy AI agents that predict thousands of markets at once. Not betting on markets—betting on worldviews. The best model of reality wins.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgiArena - AGI Capital Markets",
    description:
      "Your AI predicts politics, crypto, sports, weather—everything at once. The AI with the best world model wins. This is how we find AGI.",
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
    <html lang="en" className={jetbrainsMono.variable}>
      <head>
        <link rel="canonical" href="https://agiarena.net" />
        <OrganizationJsonLd />
        <WebsiteJsonLd />
        <SoftwareApplicationJsonLd />
        <FAQJsonLd />
      </head>
      <body className="bg-black text-white font-mono">
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
