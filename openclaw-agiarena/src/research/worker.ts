/**
 * Single Claude research worker.
 *
 * Uses the Anthropic SDK to analyse a prediction market and produce a
 * probability estimate with confidence score and reasoning.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { DiscoveredMarket, ResearchResult } from '../types'

const RESEARCH_TTL_MS = 86_400_000 // 24 hours

export class ResearchWorker {
  private client: Anthropic

  constructor(apiKey?: string) {
    // The SDK reads ANTHROPIC_API_KEY from the environment by default
    this.client = new Anthropic(apiKey ? { apiKey } : undefined)
  }

  /**
   * Research a single market and return a probability estimate.
   *
   * Sends the market details to Claude, parses the structured JSON
   * response, and validates the returned probabilities.  On any
   * failure the method returns a low-confidence fallback rather than
   * throwing so the pipeline can continue processing other markets.
   */
  async research(market: DiscoveredMarket): Promise<ResearchResult> {
    const now = Date.now()

    const prompt = [
      'You are a probability analyst for a prediction market.',
      '',
      'Research this market and return a probability estimate.',
      '',
      `MARKET: "${market.question}"`,
      `SOURCE: ${market.source}`,
      `CURRENT_ODDS: YES=${market.currentOddsYes ?? 'unknown'}`,
      `RESOLUTION: ${market.resolutionDate ?? 'unknown'}`,
      '',
      'INSTRUCTIONS:',
      '1. Consider all available information about this topic',
      '2. Analyze key factors that would influence the outcome',
      '3. Estimate probability of YES outcome',
      '',
      'Return ONLY valid JSON (no markdown, no code blocks):',
      '{"probYes":0.73,"confidence":0.82,"reasoning":"Brief explanation","sources":["relevant source descriptions"]}',
    ].join('\n')

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      })

      // Log API cost tracking
      if (response.usage) {
        console.log(
          `[agiarena] Research API usage for "${market.question}": ` +
          `input=${response.usage.input_tokens} output=${response.usage.output_tokens}`,
        )
      }

      // Extract text from the response content blocks
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')

      const parsed = JSON.parse(text) as {
        probYes: number
        confidence: number
        reasoning: string
        sources: string[]
      }

      // Validate and clamp probabilities to [0, 1]
      const probYes = clamp(parsed.probYes, 0, 1)
      const confidence = clamp(parsed.confidence, 0, 1)

      if (typeof parsed.reasoning !== 'string') {
        throw new Error('Missing reasoning in response')
      }

      const sources = Array.isArray(parsed.sources)
        ? parsed.sources.filter((s): s is string => typeof s === 'string')
        : []

      return {
        marketId: market.id,
        source: market.source,
        question: market.question,
        probYes,
        confidence,
        reasoning: parsed.reasoning,
        sources,
        researchedAt: now,
        expiresAt: now + RESEARCH_TTL_MS,
      }
    } catch (error) {
      // On any failure (API error, JSON parse, validation) return a
      // low-confidence fallback so the pipeline keeps running.
      const reason =
        error instanceof Error ? error.message : 'Unknown research error'

      console.warn(
        `[agiarena] Research failed for "${market.question}": ${reason}`,
      )

      return {
        marketId: market.id,
        source: market.source,
        question: market.question,
        probYes: 0.5,
        confidence: 0.3,
        reasoning: `Research failed: ${reason}`,
        sources: [],
        researchedAt: now,
        expiresAt: now + RESEARCH_TTL_MS,
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return (min + max) / 2
  return Math.min(max, Math.max(min, value))
}
