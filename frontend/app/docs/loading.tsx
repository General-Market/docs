import { GeneralLoader } from '@/components/ui/GeneralLoader'

export default function Loading() {
  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--apple-bg, #ffffff)' }}
    >
      <GeneralLoader height="100vh" />
    </main>
  )
}
