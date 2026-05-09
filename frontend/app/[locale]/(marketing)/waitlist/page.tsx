import type { Metadata } from 'next'
import { Caveat } from 'next/font/google'
import WaitlistForm from '@/components/marketing/WaitlistForm'

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-caveat',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Waitlist — GeneralMarket',
  description:
    'Be the first to shield your pnl from insider trading, early access, lower fees, referral rewards',
  alternates: { canonical: '/waitlist' },
  robots: { index: true, follow: true },
}

export default function WaitlistPage() {
  return (
    <div className={caveat.variable}>
      <WaitlistForm />
    </div>
  )
}
