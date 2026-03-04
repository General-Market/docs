/**
 * Warms up Next.js dev server by hitting key pages before tests start.
 * Next.js compiles pages on first request in dev mode — without this,
 * the first test to hit each page pays the compilation cost and may timeout.
 */
async function globalSetup() {
  const baseURL = 'http://localhost:3000';
  // Only warm pages that actually exist — /portfolio 404s and triggers
  // _not-found recompilation storms (5315 modules each time, blocks all requests)
  const pages = ['/', '/index'];

  for (const path of pages) {
    try {
      await fetch(`${baseURL}${path}`);
    } catch {
      // Server not ready — tests will fail anyway, don't block setup
    }
  }
}

export default globalSetup;
