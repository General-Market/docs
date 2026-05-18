import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { FirstTradeGuide } from '@/components/domain/vision/FirstTradeGuide'

export const metadata = {
  title: 'My First Vision Trade',
  description: 'A step-by-step walkthrough for placing your first prediction on Vision.',
}

export default function FirstTradePage() {
  return (
    <AppShell search={<SourceSearch />}>
      <FirstTradeGuide />
    </AppShell>
  )
}
