import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { BuildBotVSL } from '@/components/marketing/BuildBotVSL'

export const revalidate = 3600

const TITLE = 'Build a Vision Bot in One Sentence | General Market'
const DESCRIPTION =
  'Paste a single command into Claude Code. It clones the repo, configures keys, picks markets, places trades. A trading bot in less time than it takes to write a config file.'
const PATH = '/build-bot'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: PATH,
    languages: {
      en: PATH,
      ko: `/ko${PATH}`,
      ja: `/ja${PATH}`,
      zh: `/zh${PATH}`,
      'x-default': PATH,
    },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  keywords: [
    'Vision bot',
    'Claude Code',
    'prediction market bot',
    'trading bot',
    'AI trading agent',
    'General Market',
  ],
  robots: { index: true, follow: true },
}

const howToJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Build a Vision trading bot with Claude Code',
  description: DESCRIPTION,
  totalTime: 'PT2M',
  tool: [
    { '@type': 'HowToTool', name: 'Claude Code' },
    { '@type': 'HowToTool', name: 'Vision Bot template (GitHub)' },
  ],
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'Clone',
      text: 'Claude Code clones the repository onto disk. You did not type git clone.',
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'Configure',
      text: 'Keys placed, dependencies installed, defaults chosen.',
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'Trade',
      text: 'The first order goes out. The bot trades while you sleep.',
    },
  ],
}

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.generalmarket.io' },
    { '@type': 'ListItem', position: 2, name: 'Build a Bot' },
  ],
}

export default function BuildBotPage() {
  return (
    <AppShell search={<SourceSearch />}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <BuildBotVSL />
    </AppShell>
  )
}
