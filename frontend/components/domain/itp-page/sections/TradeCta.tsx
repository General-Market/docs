import { Link } from '@/i18n/routing'
import type { SectionProps } from '../SectionRenderer'

export function TradeCta({ itpId }: SectionProps) {
  return (
    <section className="flex flex-col sm:flex-row gap-3 pt-4">
      <a
        href={`/#markets`}
        className="px-6 py-3 bg-black text-white text-sm font-bold rounded-md hover:bg-zinc-800 transition-colors text-center"
      >
        Buy this Index
      </a>
      <Link
        href="/learn/what-are-itps"
        className="px-6 py-3 border-2 border-black text-sm font-bold rounded-md hover:bg-black hover:text-white transition-colors text-center"
      >
        Learn about ITPs
      </Link>
    </section>
  )
}
