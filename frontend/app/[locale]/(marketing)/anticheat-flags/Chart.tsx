import type { ChartProps, Mechanism } from './types'
import { ScamWick } from './charts/ScamWick'
import { InsiderRunup } from './charts/InsiderRunup'
import { HackDrain } from './charts/HackDrain'
import { WithdrawalFreeze } from './charts/WithdrawalFreeze'
import { WashTrading } from './charts/WashTrading'
import { ComplianceFine } from './charts/ComplianceFine'

const REGISTRY: Record<Mechanism, (p: ChartProps) => React.ReactElement> = {
  'price-wick': ScamWick,
  'insider-runup': InsiderRunup,
  'hack-drain': HackDrain,
  'withdrawal-freeze': WithdrawalFreeze,
  'wash-trading': WashTrading,
  'compliance-fine': ComplianceFine,
  // Mechanisms not yet implemented fall back to ComplianceFine so the page
  // still renders before charts for remaining venues land.
  'rug-cliff': ComplianceFine,
  'oracle-override': ComplianceFine,
  'carveout': ComplianceFine,
  'backdoor': ComplianceFine,
  'b-book-mirror': ComplianceFine,
  'outage-cascade': ComplianceFine,
  'margin-doubled': ComplianceFine,
  'socialized-loss': ComplianceFine,
  'listing-dump': InsiderRunup,
  'button-freeze': WithdrawalFreeze,
}

export function Chart({ mechanism, ...props }: { mechanism: Mechanism } & ChartProps) {
  const Component = REGISTRY[mechanism]
  return <div className="acf-card-chart">{Component(props)}</div>
}
