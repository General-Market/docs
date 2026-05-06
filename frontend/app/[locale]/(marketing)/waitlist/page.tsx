import type { Metadata } from 'next'
import WaitlistForm from '@/components/marketing/WaitlistForm'

export const metadata: Metadata = {
  title: 'Waitlist — GeneralMarket',
  description:
    'Be the first to have your pnl shielded from insider trading. Early access, lower fees, referral rewards.',
  alternates: { canonical: '/waitlist' },
  robots: { index: true, follow: true },
}

export default function WaitlistPage() {
  return <WaitlistForm />
}
