/**
 * Extract a subset of top-level namespace keys from a full messages object.
 *
 * next-intl's `getMessages()` returns every namespace loaded by request.ts.
 * Passing the full object to `NextIntlClientProvider` ships ~155 KB of JSON
 * to the client.  Most pages need only 2-3 namespaces.
 *
 * Usage (Server Component):
 *   const messages = await getMessages()
 *   const scoped  = pickMessages(messages, ['common', 'vision'])
 *   <NextIntlClientProvider messages={scoped}>
 */
export function pickMessages(
  messages: Record<string, unknown>,
  namespaces: string[],
): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const ns of namespaces) {
    if (ns in messages) {
      picked[ns] = messages[ns]
    }
  }
  return picked
}
