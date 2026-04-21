import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ClientProviders } from "./client-providers";
import { SequinWaveBackground } from "@/components/ui/SequinWaveBackground";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
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
  metadataBase: new URL("https://www.generalmarket.io"),
  authors: [{ name: "General Market", url: "https://x.com/otc_max" }],
  creator: "General Market",
  publisher: "General Market",
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
    <html lang={locale} className={`${GeistSans.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://rpc.generalmarket.io" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://api.generalmarket.io" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://us.i.posthog.com" />
        <link rel="dns-prefetch" href="https://us-assets.i.posthog.com" />
        <link rel="dns-prefetch" href="https://relay.walletconnect.com" />
        <link rel="dns-prefetch" href="https://rpc.walletconnect.org" />
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
