import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { GeneralLoader } from '@/components/ui/GeneralLoader'

export default function IndexLoading() {
  return (
    <AppShell search={<SourceSearch />}>
      <GeneralLoader height="80vh" />
    </AppShell>
  )
}
