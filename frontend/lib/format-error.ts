/**
 * Maps raw contract/HTTP errors to human-readable messages.
 *
 * The user should never see a stack trace, a Solidity selector,
 * or a URL they didn't ask for. This function stands between
 * the abyss and the toast.
 */

const USER_REJECTED = /user (rejected|denied)/i
const INSUFFICIENT = /insufficient (funds|balance)|INSUFFICIENT/i
const BLS_PENDING = /bls signature|aggregated pubkey/i
const FETCH_FAILED = /fetch failed|networkerror|failed to fetch/i
const HTTP_STATUS = /HTTP [45]\d\d/i
const STACK_TRACE = /^\s+at\s+/m
const RAW_URL = /https?:\/\/\S+/g
const SOLIDITY_REVERT = /ContractFunctionExecutionError|ContractFunctionRevertedError|execution reverted/i

/**
 * Extract a clean revert reason from a Solidity error message, if one exists.
 * Returns null if the reason is too noisy or absent.
 */
function extractRevertReason(msg: string): string | null {
  // Pattern: "reverted with reason string 'SomeReason'"
  const reasonMatch = msg.match(/reason string ['"]([^'"]+)['"]/)
  if (reasonMatch) return reasonMatch[1]

  // Pattern: "Error: SomeReason" (after Details:)
  const detailsMatch = msg.match(/Details:\s*(.+?)(?:\n|$)/)
  if (detailsMatch) {
    const detail = detailsMatch[1].trim()
    // Only use it if it's short and doesn't look like a stack trace or URL
    if (detail.length < 120 && !STACK_TRACE.test(detail) && !RAW_URL.test(detail)) {
      return detail
    }
  }

  return null
}

/**
 * Format a raw error into a user-facing message.
 *
 * @param error - The raw error (Error object, string, or unknown)
 * @param context - Optional context for fallback messages (e.g. "withdrawal", "deposit")
 */
export function formatError(error: unknown, context?: string): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Something went wrong'

  // User cancelled in wallet
  if (USER_REJECTED.test(raw)) {
    return 'Transaction cancelled'
  }

  // BLS verification not ready
  if (BLS_PENDING.test(raw)) {
    return 'Verification pending — try again in a few seconds'
  }

  // Insufficient funds
  if (INSUFFICIENT.test(raw)) {
    return 'Insufficient balance. Check your wallet.'
  }

  // Network / fetch errors
  if (FETCH_FAILED.test(raw) || HTTP_STATUS.test(raw)) {
    return 'Network request failed. Try again.'
  }

  // Solidity reverts — try to extract a clean reason
  if (SOLIDITY_REVERT.test(raw)) {
    const reason = extractRevertReason(raw)
    if (reason) return reason
    // No clean reason found — generic with context
    const label = context ? `${capitalize(context)} failed` : 'Transaction failed'
    return `${label}. Try again.`
  }

  // If the message contains stack traces or URLs, strip them
  if (STACK_TRACE.test(raw) || RAW_URL.test(raw)) {
    const label = context ? `${capitalize(context)} failed` : 'Something went wrong'
    return `${label}. Try again.`
  }

  // If the raw message is short enough and clean, use it
  if (raw.length <= 120) {
    return raw
  }

  // Fallback: context-aware generic
  const label = context ? `${capitalize(context)} failed` : 'Something went wrong'
  return `${label}. Try again.`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
