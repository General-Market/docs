import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ClientProviders } from "./client-providers";
import { SequinWaveBackground } from "@/components/ui/SequinWaveBackground";
import "./globals.css";

// Editorial serif — display headlines, hero, mastheads. Variable axes give
// optical sizing and a gentler curve at large sizes; the wonk axis is left
// at default to keep things institutional, not whimsical.
const display = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  variable: "--font-display",
  display: "swap",
});

// Body / UI sans. Plex carries the IBM research pedigree — distinct from
// every Geist/Inter SaaS clone, with a slightly mechanical cadence that
// reads as institutional rather than playful.
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

// Tabular data — KPIs, prices, tables. Matched to Plex Sans so the family
// feels intentional. Replaces JetBrains Mono.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090B",
};

// Locale-specific metadata (title, description, OG, twitter) is in [locale]/layout.tsx.
// Root layout keeps only locale-independent metadata.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://nsgame.io"),
  authors: [{ name: "nsgame" }],
  creator: "nsgame",
  publisher: "nsgame",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://us.i.posthog.com" />
      </head>
      <body className="bg-page text-text-primary font-sans antialiased" suppressHydrationWarning>
        <SequinWaveBackground />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ClientProviders>
            {children}
          </ClientProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
