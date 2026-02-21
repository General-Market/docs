import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

/**
 * Agent data interface for OG image generation
 */
interface AgentOGData {
  rank: number
  pnl: number
  roi: number
  portfolioSize: number
  winRate: number
}

/**
 * Generates deterministic performance bar heights from wallet address
 */
function generatePerformanceBars(walletAddress: string, isPositive: boolean): number[] {
  const bars: number[] = []
  for (let i = 0; i < 10; i++) {
    const charCode = walletAddress.charCodeAt((i * 4) % walletAddress.length)
    const baseHeight = 0.3 + (charCode % 50) / 100
    const trend = isPositive ? i * 0.05 : -i * 0.03
    const height = Math.min(1, Math.max(0.2, baseHeight + trend))
    bars.push(height)
  }
  return bars
}

/**
 * Fetches agent data for OG image generation from backend API
 */
async function fetchAgentData(walletAddress: string): Promise<AgentOGData | null> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL

  if (!backendUrl) {
    console.warn('NEXT_PUBLIC_BACKEND_URL not configured for OG image generation')
    return null
  }

  try {
    const response = await fetch(`${backendUrl}/api/agents/${walletAddress}`, {
      next: { revalidate: 300 }
    })

    if (!response.ok) {
      return null
    }

    const agent = await response.json()

    return {
      rank: agent.rank ?? 0,
      pnl: agent.pnl ?? 0,
      roi: agent.roi ?? 0,
      portfolioSize: agent.maxPortfolioSize ?? 0,
      winRate: agent.winRate ?? 0
    }
  } catch (error) {
    console.error('Failed to fetch agent data for OG image:', error)
    return null
  }
}

function formatPnL(pnl: number): string {
  const sign = pnl >= 0 ? '+' : '-'
  const formatted = Math.abs(pnl).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return `${sign}$${formatted}`
}

/**
 * GET /api/og/[walletAddress]
 *
 * Generates dynamic Open Graph image for portfolio sharing
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ walletAddress: string }> }
) {
  const { walletAddress } = await params

  const agent = await fetchAgentData(walletAddress)

  if (!agent) {
    // Return default General Market fallback image
    return new ImageResponse(
      (
        <div
          style={{
            background: '#09090B',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, sans-serif'
          }}
        >
          <span style={{ color: '#FAFAFA', fontSize: '64px', fontWeight: 'bold', letterSpacing: '-0.02em' }}>
            General Market
          </span>
          <span style={{ color: 'rgba(250,250,250,0.6)', fontSize: '24px', marginTop: '20px' }}>
            On-chain Index Products
          </span>
        </div>
      ),
      {
        width: 1200,
        height: 630
      }
    )
  }

  const pnlColor = agent.pnl >= 0 ? '#16A34A' : '#DC2626'

  return new ImageResponse(
    (
      <div
        style={{
          background: '#09090B',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '48px',
          fontFamily: 'system-ui, sans-serif'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '32px'
          }}
        >
          <span style={{ color: '#FAFAFA', fontSize: '36px', fontWeight: 'bold', letterSpacing: '-0.02em' }}>
            General Market
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#18181B',
              color: '#FAFAFA',
              padding: '12px 24px',
              borderRadius: '12px',
              fontSize: '28px',
              fontWeight: 'bold',
              border: '1px solid #3F3F46'
            }}
          >
            #{agent.rank}
          </div>
        </div>

        {/* Large P&L number */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center'
          }}
        >
          <span
            style={{
              fontSize: '96px',
              fontWeight: 'bold',
              color: pnlColor,
              lineHeight: 1.1,
              fontFamily: 'monospace'
            }}
          >
            {formatPnL(agent.pnl)}
          </span>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              gap: '48px',
              marginTop: '32px',
              color: 'rgba(250,250,250,0.7)',
              fontSize: '28px'
            }}
          >
            <span>{(agent.portfolioSize ?? 0).toLocaleString()} positions</span>
            <span>{agent.winRate ?? 0}% win rate</span>
            <span>{(agent.roi ?? 0) >= 0 ? '+' : ''}{(agent.roi ?? 0).toFixed(1)}% ROI</span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginTop: '32px',
            borderTop: '1px solid #3F3F46',
            paddingTop: '24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '80px' }}>
            {generatePerformanceBars(walletAddress, agent.pnl >= 0).map((height, i) => (
              <div
                key={i}
                style={{
                  width: '24px',
                  height: `${height * 80}px`,
                  background: agent.pnl >= 0 ? '#16A34A' : '#DC2626',
                  opacity: 0.4 + (i * 0.06),
                  borderRadius: '4px'
                }}
              />
            ))}
          </div>

          <span style={{ color: 'rgba(250,250,250,0.4)', fontSize: '20px', fontFamily: 'monospace' }}>
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
      }
    }
  )
}
