"use client";

/* The ```gm-try fence — a live API explorer. One fence documents one endpoint:
   the reader edits the params (and the JSON body on writes), presses Send, and
   reads the real response in-page. Calls are same-origin: every documented
   path is served by this app's /api proxy layer, so the browser needs no CORS
   and no keys. The fence's `response` object renders as a collapsed example —
   illustrative only, never auto-executed.

   Fence body schema (docs/docs-rebuild/writer-brief.md):
   { method, path, params?: [{name, in: "query"|"path", type, required, desc}],
     body?, response? }

   Path params come in two authored shapes, both supported:
   - template:  /vision/player/{address}/profile  → the param substitutes in
   - literal:   /vision/config/crypto             → the path itself is editable */

import { useMemo, useState } from "react";

interface ParamSpec {
  name: string;
  in?: "query" | "path";
  type?: string;
  required?: boolean;
  desc?: string;
}

interface TrySpec {
  method: string;
  path: string;
  params?: ParamSpec[];
  body?: unknown;
  response?: unknown;
}

interface Result {
  status: number;
  statusText: string;
  ms: number;
  body: string;
  ok: boolean;
}

function parseSpec(raw: string): TrySpec | { error: string } {
  try {
    const s = JSON.parse(raw) as TrySpec;
    if (!s.method || !s.path) return { error: "gm-try spec needs a method and a path" };
    return s;
  } catch (e) {
    return { error: `invalid gm-try spec: ${(e as Error).message}` };
  }
}

/** Same-origin URL rule: /api/* paths are already routes in this app; every
 *  other documented path lives behind the /api proxy prefix. */
function toApiUrl(path: string): string {
  return path === "/api" || path.startsWith("/api/") ? path : `/api${path}`;
}

function placeholderNames(path: string): string[] {
  return [...path.matchAll(/\{([^}/]+)\}/g)].map((m) => m[1]);
}

export function GmTry({ spec: raw }: { spec: string }) {
  const parsed = useMemo(() => parseSpec(raw), [raw]);
  if ("error" in parsed) {
    return <div className="gm-api gm-api-bad">{parsed.error}</div>;
  }
  return <Explorer spec={parsed} />;
}

function Explorer({ spec }: { spec: TrySpec }) {
  const method = spec.method.toUpperCase();
  const params = spec.params ?? [];
  const queryParams = params.filter((p) => p.in !== "path");
  const placeholders = placeholderNames(spec.path);
  const templateParams = params.filter((p) => p.in === "path" && placeholders.includes(p.name));
  // Path params authored as literal values in the path (no {placeholder}) —
  // the path itself becomes the editable field; these rows stay as docs.
  const literalParams = params.filter((p) => p.in === "path" && !placeholders.includes(p.name));
  const pathEditable = literalParams.length > 0;

  const [pathValue, setPathValue] = useState(spec.path);
  const [pathInputs, setPathInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(templateParams.map((p) => [p.name, ""])),
  );
  const [queryInputs, setQueryInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(queryParams.map((p) => [p.name, ""])),
  );
  const [bodyText, setBodyText] = useState<string>(() =>
    spec.body != null ? JSON.stringify(spec.body, null, 2) : "",
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const hasBody = method !== "GET" && method !== "HEAD";

  // Build the request URL from the current inputs.
  let urlPath = pathEditable ? pathValue : spec.path;
  for (const p of templateParams) {
    const v = pathInputs[p.name] ?? "";
    urlPath = urlPath.replace(`{${p.name}}`, v === "" ? `{${p.name}}` : encodeURIComponent(v));
  }
  const qs = queryParams
    .map((p) => [p.name, (queryInputs[p.name] ?? "").trim()] as const)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const url = `${toApiUrl(urlPath)}${qs ? `${urlPath.includes("?") ? "&" : "?"}${qs}` : ""}`;

  const missingPath = templateParams.filter((p) => (pathInputs[p.name] ?? "").trim() === "");
  const canSend = missingPath.length === 0 && !loading;

  async function send() {
    if (!canSend) return;
    let body: string | undefined;
    const headers: Record<string, string> = {};
    if (hasBody && bodyText.trim()) {
      try {
        JSON.parse(bodyText);
      } catch (e) {
        setResult({
          status: 0,
          statusText: "request not sent",
          ms: 0,
          body: `The body is not valid JSON: ${(e as Error).message}`,
          ok: false,
        });
        return;
      }
      headers["Content-Type"] = "application/json";
      body = bodyText.trim();
    }
    setLoading(true);
    setResult(null);
    const t0 = performance.now();
    try {
      const res = await fetch(url, { method, headers, body });
      const ms = Math.round(performance.now() - t0);
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* not JSON — show the raw text */
      }
      setResult({ status: res.status, statusText: res.statusText, ms, body: pretty || "(empty response)", ok: res.ok });
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      setResult({
        status: 0,
        statusText: "network error",
        ms,
        body: `${(e as Error).message}\n\nThe call never reached the API — check your network, or run it from your own client.`,
        ok: false,
      });
    } finally {
      setLoading(false);
    }
  }

  const hasInputs = templateParams.length > 0 || queryParams.length > 0 || pathEditable || hasBody;

  return (
    <div className="gm-api">
      <header className="gm-api-head">
        <span className={`gm-api-method m-${method.toLowerCase()}`}>{method}</span>
        <code className="gm-api-path">{spec.path}</code>
      </header>

      <div className="gm-api-grid">
        {/* ── left: editable parameter rows ── */}
        <div>
          {pathEditable ? (
            <section className="gm-api-set">
              <h4 className="gm-api-set-label">Path</h4>
              <div className="gm-api-row">
                <input
                  className="gm-api-in"
                  value={pathValue}
                  onChange={(e) => setPathValue(e.target.value)}
                  spellCheck={false}
                  aria-label="Request path"
                />
              </div>
              {literalParams.map((p) => (
                <ParamMeta key={p.name} p={p} note="edit the value in the path above" />
              ))}
            </section>
          ) : null}

          {templateParams.length > 0 ? (
            <section className="gm-api-set">
              <h4 className="gm-api-set-label">Path params</h4>
              {templateParams.map((p) => (
                <div key={p.name} className="gm-api-row">
                  <span className="gm-api-meta">
                    <span className="gm-api-name">{p.name}</span>
                    <span className="gm-api-type">{p.type ?? "string"}</span>
                    <span className="gm-api-req">required</span>
                  </span>
                  <input
                    className="gm-api-in"
                    value={pathInputs[p.name] ?? ""}
                    onChange={(e) => setPathInputs((s) => ({ ...s, [p.name]: e.target.value }))}
                    placeholder={p.desc ?? p.name}
                    spellCheck={false}
                  />
                </div>
              ))}
            </section>
          ) : null}

          {queryParams.length > 0 ? (
            <section className="gm-api-set">
              <h4 className="gm-api-set-label">Query</h4>
              {queryParams.map((p) => (
                <div key={p.name} className="gm-api-row">
                  <span className="gm-api-meta">
                    <span className="gm-api-name">{p.name}</span>
                    <span className="gm-api-type">{p.type ?? "string"}</span>
                    {p.required ? <span className="gm-api-req">required</span> : null}
                  </span>
                  <input
                    className="gm-api-in"
                    value={queryInputs[p.name] ?? ""}
                    onChange={(e) => setQueryInputs((s) => ({ ...s, [p.name]: e.target.value }))}
                    placeholder={p.desc ?? ""}
                    spellCheck={false}
                  />
                </div>
              ))}
            </section>
          ) : null}

          {hasBody ? (
            <section className="gm-api-set">
              <h4 className="gm-api-set-label">Body · JSON</h4>
              <textarea
                className="gm-api-body"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                spellCheck={false}
                rows={Math.min(12, Math.max(3, bodyText.split("\n").length))}
                aria-label="JSON request body"
              />
            </section>
          ) : null}

          {!hasInputs ? <p className="gm-api-noparams">No parameters.</p> : null}
        </div>

        {/* ── right: the exact request, Send, the live response ── */}
        <div className="gm-api-right">
          <div className="gm-api-panel">
            <pre className="gm-api-snippet">
              <code>{`${method} ${url}${hasBody && bodyText.trim() ? `\n\n${bodyText.trim()}` : ""}`}</code>
            </pre>
            <button className="gm-api-try" onClick={send} disabled={!canSend} type="button">
              {loading ? "Sending…" : "Send"}
            </button>
          </div>
          {missingPath.length > 0 ? (
            <p className="gm-api-hint">
              Fill {missingPath.map((p) => p.name).join(", ")} to send the request.
            </p>
          ) : null}

          <div className="gm-api-res">
            <div className="gm-api-res-head">
              {result ? (
                <span className={`gm-api-status ${result.ok ? "is-ok" : "is-err"}`}>
                  <span className="gm-api-dot" />
                  {`${result.status || "—"} ${result.statusText} · ${result.ms} ms`}
                </span>
              ) : (
                <span className="gm-api-status is-idle">
                  <span className="gm-api-dot" />
                  Response
                </span>
              )}
            </div>
            {result ? (
              <pre className="gm-api-out">
                <code>{result.body}</code>
              </pre>
            ) : (
              <div className="gm-api-res-empty">
                Press <strong>Send</strong> to run the call and read the live response.
              </div>
            )}
          </div>

          {spec.response !== undefined ? (
            <details className="gm-api-example">
              <summary>Example response</summary>
              <pre className="gm-api-out">
                <code>{JSON.stringify(spec.response, null, 2)}</code>
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ParamMeta({ p, note }: { p: ParamSpec; note: string }) {
  return (
    <div className="gm-api-row">
      <span className="gm-api-meta">
        <span className="gm-api-name">{p.name}</span>
        <span className="gm-api-type">{p.type ?? "string"}</span>
        {p.required ? <span className="gm-api-req">required</span> : null}
      </span>
      <span className="gm-api-litnote">{p.desc ? `${p.desc} — ${note}` : note}</span>
    </div>
  );
}
