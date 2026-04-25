import { CalendarPageClient } from './CalendarPageClient'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await params
  return {
    title: 'nsgame · calendar',
    description: 'Markets that close soon. Pick a side. Wait.',
  }
}

export default function CalendarPage() {
  return <CalendarPageClient />
}
