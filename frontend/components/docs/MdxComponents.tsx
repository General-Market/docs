import * as React from 'react'
import Link from 'next/link'
import type { MDXComponents } from 'mdx/types'
import { ThreePillars, MoneyFlow, ArchSchematic, GeneralMarketArchitecture } from './Schematics'
import {
  OverviewSystemArch,
  OverviewTwoChains,
  OverviewDataFlow,
  OverviewOrderLifecycle,
  OverviewBridgeOrderFlow,
  OverviewVisionLifecycle,
  OverviewConnectivityMap,
  OverviewInfrastructure,
  OverviewTechStack,
  BridgeChainOverview,
  BridgeContractLayout,
  BridgeDecimalConversion,
  BridgeBuyFlow,
  BridgeCrashRecovery,
  BridgeSellFlow,
  BridgeFailedSellRecovery,
  BridgeBackingInvariant,
  BridgeOrderStates,
  BridgeReplayProtection,
  BridgeTiming,
} from './SchematicsArchHeavy'
import {
  ContractsOrderLifecycle,
  DataNodeOverview,
  OracleApIsolation,
  OrderStateMachine,
} from './SchematicsArchLight'
import {
  OverviewArchitecture,
  WeightToQuantity,
  NavDecomposition,
  TwoChainsArchitecture,
  WhichChainTable,
  UsdcDecimals,
  BridgeFlow,
  SettlementQuickReference,
} from './SchematicsGuides'

function Callout({
  variant,
  glyph,
  children,
}: {
  variant: 'note' | 'tip' | 'warning' | 'info'
  glyph: string
  children: React.ReactNode
}) {
  return (
    <div className={`mdx-callout mdx-callout-${variant}`}>
      <span className="mdx-callout-icon" aria-hidden="true">
        {glyph}
      </span>
      <div className="mdx-callout-body">{children}</div>
    </div>
  )
}

const Note = ({ children }: { children: React.ReactNode }) => (
  <Callout variant="note" glyph="i">
    {children}
  </Callout>
)
const Tip = ({ children }: { children: React.ReactNode }) => (
  <Callout variant="tip" glyph="✓">
    {children}
  </Callout>
)
const Warning = ({ children }: { children: React.ReactNode }) => (
  <Callout variant="warning" glyph="!">
    {children}
  </Callout>
)
const Info = ({ children }: { children: React.ReactNode }) => (
  <Callout variant="info" glyph="i">
    {children}
  </Callout>
)

function Card({
  title,
  href,
  icon,
  children,
}: {
  title?: string
  href?: string
  icon?: string
  children?: React.ReactNode
}) {
  const inner = (
    <>
      {icon ? (
        <span className="mdx-card-icon" aria-hidden="true">
          {icon[0]?.toUpperCase()}
        </span>
      ) : null}
      {title ? <span className="mdx-card-title">{title}</span> : null}
      {children ? <div className="mdx-card-body">{children}</div> : null}
    </>
  )
  if (href) {
    const external = /^https?:/i.test(href)
    if (external) {
      return (
        <a className="mdx-card" href={href} target="_blank" rel="noreferrer">
          {inner}
        </a>
      )
    }
    return (
      <Link className="mdx-card" href={href}>
        {inner}
      </Link>
    )
  }
  return <div className="mdx-card">{inner}</div>
}

function CardGroup({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div
      className="mdx-cardgroup"
      style={{ ['--cardgroup-cols' as string]: String(Math.max(1, Math.min(4, cols))) }}
    >
      {children}
    </div>
  )
}

type TabChild = React.ReactElement<{ title?: string; children?: React.ReactNode }>

function Tabs({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(React.isValidElement) as TabChild[]
  return (
    <div className="mdx-tabs">
      <div className="mdx-tabs-bar" role="tablist">
        {items.map((it, i) => (
          <span
            key={i}
            role="tab"
            aria-selected={i === 0}
            data-active={i === 0}
            className="mdx-tabs-trigger"
          >
            {it.props.title ?? `Tab ${i + 1}`}
          </span>
        ))}
      </div>
      {items.map((it, i) => (
        <div key={i} className="mdx-tabs-panel" role="tabpanel" hidden={i !== 0}>
          {it.props.children}
        </div>
      ))}
    </div>
  )
}
const Tab = ({ children }: { title?: string; children: React.ReactNode }) => <>{children}</>

function CodeGroup({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<{
    title?: string
    filename?: string
    children?: React.ReactNode
  }>[]
  return (
    <div className="mdx-codegroup">
      <div className="mdx-codegroup-bar" role="tablist">
        {items.map((it, i) => (
          <span
            key={i}
            role="tab"
            data-active={i === 0}
            className="mdx-codegroup-trigger"
          >
            {it.props.title ?? it.props.filename ?? `Source ${i + 1}`}
          </span>
        ))}
      </div>
      {items.map((it, i) => (
        <div key={i} className="mdx-codegroup-panel" data-active={i === 0} role="tabpanel">
          {it}
        </div>
      ))}
    </div>
  )
}

function Steps({ children }: { children: React.ReactNode }) {
  const steps = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<{
    title?: string
    children?: React.ReactNode
  }>[]
  return (
    <div className="mdx-steps">
      {steps.map((s, i) => (
        <div key={i} className="mdx-step">
          <span className="mdx-step-marker" aria-hidden="true" />
          <div className="mdx-step-body">
            {s.props.title ? <div className="mdx-step-title">{s.props.title}</div> : null}
            {s.props.children}
          </div>
        </div>
      ))}
    </div>
  )
}
const Step = ({ children }: { title?: string; children: React.ReactNode }) => <>{children}</>

function Frame({ caption, children }: { caption?: string; children: React.ReactNode }) {
  return (
    <figure className="mdx-frame">
      {children}
      {caption ? <figcaption className="mdx-frame-caption">{caption}</figcaption> : null}
    </figure>
  )
}

function Expandable({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <details className="mdx-expandable">
      <summary>{title ?? 'Details'}</summary>
      <div className="mdx-expandable-body">{children}</div>
    </details>
  )
}

function ParamField({
  path,
  query,
  body,
  type,
  required,
  default: def,
  children,
}: {
  path?: string
  query?: string
  body?: string
  type?: string
  required?: boolean
  default?: string
  children?: React.ReactNode
}) {
  const name = path ?? query ?? body ?? ''
  return (
    <div className="mdx-paramfield">
      <div className="mdx-paramfield-head">
        {name ? <span className="mdx-paramfield-name">{name}</span> : null}
        {type ? <span className="mdx-paramfield-type">{type}</span> : null}
        {required ? <span className="mdx-paramfield-required">required</span> : null}
        {def !== undefined ? (
          <span className="mdx-paramfield-default">default: {def}</span>
        ) : null}
      </div>
      {children ? <div className="mdx-paramfield-body">{children}</div> : null}
    </div>
  )
}

function Snippet({ file, children }: { file?: string; children?: React.ReactNode }) {
  if (children) return <>{children}</>
  return <span className="mdx-snippet">snippet: {file}</span>
}

export const mdxComponents: MDXComponents = {
  Note,
  Tip,
  Warning,
  Info,
  Card,
  CardGroup,
  Tabs,
  Tab,
  CodeGroup,
  Steps,
  Step,
  Frame,
  Expandable,
  ParamField,
  Snippet,
  ThreePillars,
  MoneyFlow,
  ArchSchematic,
  GeneralMarketArchitecture,
  OverviewSystemArch,
  OverviewTwoChains,
  OverviewDataFlow,
  OverviewOrderLifecycle,
  OverviewBridgeOrderFlow,
  OverviewVisionLifecycle,
  OverviewConnectivityMap,
  OverviewInfrastructure,
  OverviewTechStack,
  BridgeChainOverview,
  BridgeContractLayout,
  BridgeDecimalConversion,
  BridgeBuyFlow,
  BridgeCrashRecovery,
  BridgeSellFlow,
  BridgeFailedSellRecovery,
  BridgeBackingInvariant,
  BridgeOrderStates,
  BridgeReplayProtection,
  BridgeTiming,
  ContractsOrderLifecycle,
  DataNodeOverview,
  OracleApIsolation,
  OrderStateMachine,
  OverviewArchitecture,
  WeightToQuantity,
  NavDecomposition,
  TwoChainsArchitecture,
  WhichChainTable,
  UsdcDecimals,
  BridgeFlow,
  SettlementQuickReference,
  a: (props) => {
    const href = props.href ?? ''
    if (/^https?:/i.test(href)) {
      return <a {...props} target="_blank" rel="noreferrer" />
    }
    return <a {...props} />
  },
}

