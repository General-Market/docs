// Idempotent wrapper for R3F asset preloaders (useGLTF.preload, useTexture.preload,
// useLoader.preload). Module-scope preload calls re-fire on every Fast Refresh
// pass and force the studio to rebuild the WebGL context, which masquerades as
// "HMR is broken — restart to see changes". Routing every preload through a
// shared Set means the loader runs once per URL per process.

const seen = new Set<string>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPreload = (...args: any[]) => any;

export function preloadOnce(loader: AnyPreload, url: string): void {
  if (seen.has(url)) return;
  seen.add(url);
  loader(url);
}

// Variant for useLoader.preload(LoaderClass, url) — the loader takes an extra
// constructor argument before the URL.
export function preloadOnceWith<T>(
  loader: AnyPreload,
  loaderCtor: T,
  url: string,
): void {
  const key = `${(loaderCtor as { name?: string })?.name ?? "loader"}::${url}`;
  if (seen.has(key)) return;
  seen.add(key);
  loader(loaderCtor, url);
}
