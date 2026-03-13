import { getItpPageConfig } from '@/lib/itp-page-config'
import type { SectionProps } from '../SectionRenderer'

export function InvestmentObjective({ itpId }: SectionProps) {
  const config = getItpPageConfig(itpId)
  const obj = config.investmentObjective
  if (!obj) return null

  return (
    <section className="py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-4">Why This Index?</h2>
          <ol className="list-decimal list-inside space-y-4 text-sm text-text-secondary leading-relaxed">
            {obj.whyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-4">Investment Objective</h2>
          <p className="text-sm text-text-secondary leading-relaxed">{obj.objective}</p>
        </div>
      </div>
    </section>
  )
}
