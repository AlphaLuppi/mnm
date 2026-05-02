import { HOOK_ERROR_CODES, type HookErrorCode } from "@mnm/governed-workflows";
import type { GitProvider } from "@mnm/git-provider";
import type {
  ConnectorTokenSource,
  HostHelpers,
  HttpRequest,
  HttpResponse,
  LlmRequest,
  LlmResponse,
  FetchHandoffArgs,
} from "./types.js";

/**
 * Custom error carrying a `HOOK_ERROR_CODES` member. Thrown by host
 * helpers when a deterministic precondition fails (provider not allowed,
 * user not connected, SSRF blocked). The runner catches these and
 * surfaces them on the audit row + to the orchestrator. They never reach
 * the isolate as a typed code — only as an exception with a host
 * message.
 */
export class HookHelperError extends Error {
  constructor(public errorCode: HookErrorCode, message: string) {
    super(message);
    this.name = "HookHelperError";
  }
}

/**
 * Sensitive header names that the host strips from `HttpRequest.headers`
 * before issuing the outbound request. Authors cannot bypass auth
 * selection from inside the isolate. Comparison is case-insensitive
 * AND unicode-normalized (NFKC + whitespace/zero-width strip) to defeat
 * unicode/whitespace bypass attempts (e.g. zero-width space slipped into
 * "authorization").
 */
const FORBIDDEN_HEADERS = new Set([
  "authorization",
  "auth",
  "x-api-key",
  "x-auth-token",
  "x-amz-security-token",
  "cookie",
  "proxy-authorization",
  "proxy-authenticate",
  "www-authenticate",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
  "host",
]);

/**
 * Strip unicode whitespace + zero-width / bidi / BOM characters that
 * authors could splice into a header name to bypass the toLowerCase()
 * check. Plain ASCII whitespace is also covered. Unicode categories Zs
 * (space separator), Cf (format / zero-width / bidi), plus explicit BOM.
 */
function stripInvisibles(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    // ASCII whitespace
    if (ch === " " || ch === "\t") continue;
    // Zero-width / bidi / format controls (U+200B..U+200F, U+202A..U+202E,
    // U+2060..U+206F, U+FEFF) — covers ZWSP, ZWNJ, ZWJ, LRE/RLE/PDF/LRO/RLO,
    // word joiner, BOM, etc.
    if (
      (cp >= 0x200b && cp <= 0x200f) ||
      (cp >= 0x202a && cp <= 0x202e) ||
      (cp >= 0x2060 && cp <= 0x206f) ||
      cp === 0xfeff
    ) {
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Normalize a header name for the forbidden-list check:
 *   1. NFKC unicode normalization (collapses compatibility forms).
 *   2. Strip ASCII whitespace + zero-width / bidi / BOM characters.
 *   3. Lowercase.
 *
 * Returns "" when the result is empty (which we treat as invalid and
 * reject).
 */
function normalizeHeaderName(name: string): string {
  return stripInvisibles(name.normalize("NFKC")).toLowerCase();
}

export interface BuildHostHelpersDeps {
  /**
   * `(rawUrl) => void`  Throws on any unsafe URL (RFC-1918, link-local,
   * private TLDs, etc.). MUST be called immediately before each outbound
   * fetch — DNS rebinding mitigation. In production the server passes
   * `assertSafePublicUrl` from `server/src/services/ssrf-guard.ts`.
   *
   * V0 single-resolve guard. V1 will host-pin the resolved IP and force
   * the Host header (TODO in `host-helpers.ts`).
   */
  assertSafeUrl: (rawUrl: string) => Promise<void>;
  /**
   * Connector lookup + token resolution. The host calls
   * `getActiveConnectorBySlug(companyId, providerSlug)` first to surface
   * `HOOK_PROVIDER_NOT_ALLOWED` on unknown providers, then
   * `getUserToken(userId, providerSlug, companyId)` which itself runs the
   * cross-tenant guard.
   */
  connectors: ConnectorTokenSource;
  /** Git provider for `fetchHandoff`. Pinned by the run's git sha. */
  gitProvider: GitProvider;
  /**
   * LLM provider abstraction. V0 = Anthropic only, but the helper API is
   * provider-agnostic so V1 can swap implementations without changing
   * hooks. `tokenBudgetRemaining` returns the company's remaining LLM
   * budget for the current run; the helper short-circuits if the next
   * call would exceed it (`HOOK_LLM_BUDGET_EXCEEDED`).
   */
  llm: {
    invoke(req: LlmRequest): Promise<LlmResponse>;
    /**
     * Estimated input token count for `req.system + req.prompt` — used to
     * pre-flight the budget check before the upstream provider is called.
     * V0 implementations may approximate (e.g. 1 token per 4 chars).
     */
    estimateInputTokens(req: LlmRequest): number;
    tokenBudgetRemaining(): number | null;
  };
  /**
   * HTTP fetch implementation. Defaults to `globalThis.fetch`. Tests
   * inject a stub. Production passes a fetch that respects MnM proxy
   * config + sets a 30 s socket timeout.
   */
  fetchImpl?: typeof fetch;
  /** Run-scoped audit hook fired on every successful HTTP / LLM call. */
  onCallSuccess?: (kind: "http" | "llm", meta: Record<string, unknown>) => void;
  /** Run-scoped audit hook fired on every failed HTTP / LLM call. */
  onCallError?: (
    kind: "http" | "llm",
    err: HookHelperError | Error,
    meta: Record<string, unknown>,
  ) => void;
}

export interface BuildHostHelpersRuntimeCtx {
  companyId: string;
  /**
   * The actor user under whose identity this hook run executes
   * (decision-log §1.7 universal traceability). Hooks NEVER run as a
   * service account — every helper call is attributed to a real human.
   */
  actorUserId: string;
  /** Run id for `fetchHandoff` git sha lookup. */
  runId: string;
  /** Pinned git sha for the current workflow run. */
  workflowGitSha: string;
}

/**
 * Build the `HostHelpers` bundle wired into the isolate as
 * `ctx.helpers.<name>`. Each invocation is fully attributed to the
 * provided `actorUserId`.
 */
export function buildHostHelpers(
  deps: BuildHostHelpersDeps,
  runtime: BuildHostHelpersRuntimeCtx,
): HostHelpers {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error(
      "buildHostHelpers: fetchImpl missing — pass a fetch implementation explicitly",
    );
  }

  return {
    http: (req) => httpHelper(req, deps, runtime, fetchImpl),
    llm: (req) => llmHelper(req, deps, runtime),
    fetchHandoff: (args) => fetchHandoffHelper(args, deps, runtime),
  };
}

// ─── http ──────────────────────────────────────────────────────────────────

async function httpHelper(
  req: HttpRequest,
  deps: BuildHostHelpersDeps,
  runtime: BuildHostHelpersRuntimeCtx,
  fetchImpl: typeof fetch,
): Promise<HttpResponse> {
  if (!req || typeof req !== "object") {
    throw new Error("http: req must be an object");
  }
  if (typeof req.provider !== "string" || req.provider.length === 0) {
    throw new Error("http: req.provider is required (string)");
  }
  if (typeof req.path !== "string" || !req.path.startsWith("/")) {
    throw new Error("http: req.path is required and must start with '/'");
  }

  // 1. Connector lookup (provider whitelist) — short-circuit on unknown.
  const connector = await deps.connectors.getActiveConnectorBySlug(
    runtime.companyId,
    req.provider,
  );
  if (!connector) {
    const err = new HookHelperError(
      HOOK_ERROR_CODES.HOOK_PROVIDER_NOT_ALLOWED,
      `Provider '${req.provider}' is not configured for this company`,
    );
    deps.onCallError?.("http", err, { provider: req.provider });
    throw err;
  }

  // 2. Token resolution — cross-tenant guard runs INSIDE getUserToken.
  let token: { accessToken: string; type: string };
  try {
    const resolved = await deps.connectors.getUserToken(
      runtime.actorUserId,
      req.provider,
      runtime.companyId,
    );
    token = { accessToken: resolved.accessToken, type: resolved.type };
  } catch (cause) {
    const err = mapConnectorError(cause, req.provider);
    deps.onCallError?.("http", err, { provider: req.provider });
    throw err;
  }

  // 3. Strip caller-supplied auth headers (authors cannot override host
  //    auth selection from inside the isolate). Keep everything else.
  const headers = sanitizeHeaders(req.headers);

  // 4. Inject host-controlled auth.
  if (token.type === "oauth2") {
    headers.set("Authorization", `Bearer ${token.accessToken}`);
  } else if (token.type === "api_key") {
    const headerName = connector.apiKeyHeader ?? "X-API-Key";
    headers.set(headerName, token.accessToken);
  } else {
    // Unknown connector type — fail closed.
    throw new HookHelperError(
      HOOK_ERROR_CODES.HOOK_PROVIDER_NOT_ALLOWED,
      `Connector type '${token.type}' is not supported`,
    );
  }

  // 5. Build the URL and run SSRF guard immediately before fetch.
  const url = buildUrl(connector.baseUrl, req.path, req.query);
  try {
    await deps.assertSafeUrl(url);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const err = new HookHelperError(
      HOOK_ERROR_CODES.HOOK_SSRF_BLOCKED,
      `SSRF guard rejected URL: ${message}`,
    );
    deps.onCallError?.("http", err, { provider: req.provider, url });
    throw err;
  }

  // 6. Issue the fetch. Body is JSON-encoded for object payloads, raw
  //    string otherwise. Content-Type is auto-set when missing.
  const method = (req.method ?? "GET").toUpperCase();
  const body =
    req.body === undefined || method === "GET" || method === "DELETE"
      ? undefined
      : typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body);
  if (
    body !== undefined &&
    !headers.has("content-type") &&
    typeof req.body !== "string"
  ) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetchImpl(url, { method, headers, body });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const err = new Error(`http: fetch failed: ${message}`);
    deps.onCallError?.("http", err, { provider: req.provider, url, method });
    throw err;
  }

  const responseBody = await readResponseBody(response);
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  deps.onCallSuccess?.("http", {
    provider: req.provider,
    url,
    method,
    status: response.status,
  });

  return {
    status: response.status,
    body: responseBody,
    headers: responseHeaders,
  };
}

function sanitizeHeaders(input: Record<string, string> | undefined): Headers {
  const headers = new Headers();
  if (!input) return headers;
  for (const [name, value] of Object.entries(input)) {
    if (typeof name !== "string" || typeof value !== "string") continue;

    // Reject names containing CRLF — header-injection attempt
    // ("X-Foo: bar\r\nAuthorization: Bearer ATTACKER").
    if (/[\r\n]/.test(name)) {
      throw new HookHelperError(
        HOOK_ERROR_CODES.HOOK_EXCEPTION,
        `Invalid header name: contains CR/LF`,
      );
    }
    // Reject values containing CRLF — same injection vector via value.
    if (/[\r\n]/.test(value)) {
      throw new HookHelperError(
        HOOK_ERROR_CODES.HOOK_EXCEPTION,
        `Invalid header value: contains CR/LF`,
      );
    }

    const normalized = normalizeHeaderName(name);
    // Empty after normalization → all-zero-width / whitespace garbage.
    if (normalized.length === 0) {
      throw new HookHelperError(
        HOOK_ERROR_CODES.HOOK_EXCEPTION,
        `Invalid header name: empty after normalization`,
      );
    }

    if (FORBIDDEN_HEADERS.has(normalized)) continue;
    headers.set(name, value);
  }
  return headers;
}

function buildUrl(
  baseUrl: string,
  path: string,
  query: Record<string, string> | undefined,
): string {
  const trimmedBase = baseUrl.endsWith("/")
    ? baseUrl.slice(0, -1)
    : baseUrl;
  const url = new URL(`${trimmedBase}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (typeof k === "string" && typeof v === "string") {
        url.searchParams.append(k, v);
      }
    }
  }
  return url.toString();
}

/**
 * Hard cap on outbound HTTP response bodies surfaced into the isolate.
 * Prevents a malicious / misconfigured upstream from OOMing the host by
 * streaming gigabytes back. Surface as `HOOK_RESPONSE_TOO_LARGE` if
 * exceeded.
 */
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MiB

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await readBoundedText(response, MAX_RESPONSE_BYTES);
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  return text;
}

/**
 * Stream the response body capped at `maxBytes`. Throws
 * `HOOK_RESPONSE_TOO_LARGE` (via `HookHelperError`) once the running byte
 * counter exceeds the cap, even if the upstream has not finished
 * streaming. Falls back to `response.text()` only when no readable
 * stream is exposed (test stubs); in that case the cap is enforced on
 * the resulting string's UTF-8 byte length.
 */
async function readBoundedText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const fallback = await response.text();
    if (Buffer.byteLength(fallback, "utf8") > maxBytes) {
      throw new HookHelperError(
        "HOOK_RESPONSE_TOO_LARGE" as HookErrorCode,
        `HTTP response body exceeds ${maxBytes} bytes`,
      );
    }
    return fallback;
  }
  const decoder = new TextDecoder("utf-8");
  let received = 0;
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // Best-effort cancel; the body is being abandoned anyway.
        }
        throw new HookHelperError(
          "HOOK_RESPONSE_TOO_LARGE" as HookErrorCode,
          `HTTP response body exceeds ${maxBytes} bytes`,
        );
      }
      out += decoder.decode(value, { stream: true });
    }
  }
  out += decoder.decode();
  return out;
}

/**
 * Map a `ConnectorError` (thrown by `connectorService.getUserToken`) to
 * the equivalent `HOOK_*` code. Connector errors carry a `code` property
 * — we read it via duck typing to avoid a runtime import.
 */
function mapConnectorError(cause: unknown, provider: string): HookHelperError {
  const code =
    cause && typeof cause === "object" && "code" in cause
      ? String((cause as { code: unknown }).code)
      : "UNKNOWN";
  const message = cause instanceof Error ? cause.message : String(cause);
  switch (code) {
    case "CONNECTOR_NOT_CONFIGURED":
      return new HookHelperError(
        HOOK_ERROR_CODES.HOOK_PROVIDER_NOT_ALLOWED,
        `Provider '${provider}' is not configured`,
      );
    case "CONNECTOR_USER_NOT_CONNECTED":
      return new HookHelperError(
        HOOK_ERROR_CODES.HOOK_USER_NOT_CONNECTED,
        `User has not connected '${provider}' — ${message}`,
      );
    case "CONNECTOR_TOKEN_EXPIRED_NO_REFRESH":
    case "CONNECTOR_TOKEN_REVOKED":
      return new HookHelperError(
        HOOK_ERROR_CODES.HOOK_TOKEN_EXPIRED,
        `Token expired for '${provider}' — user must reconnect`,
      );
    case "CONNECTOR_USER_NOT_IN_COMPANY":
      return new HookHelperError(
        HOOK_ERROR_CODES.HOOK_USER_NOT_IN_COMPANY,
        `User is not a member of this company`,
      );
    default:
      // Anything else surfaces as HOOK_EXCEPTION via the runner classifier.
      return new HookHelperError(
        HOOK_ERROR_CODES.HOOK_EXCEPTION,
        `Connector error (${code}): ${message}`,
      );
  }
}

// ─── llm ───────────────────────────────────────────────────────────────────

async function llmHelper(
  req: LlmRequest,
  deps: BuildHostHelpersDeps,
  runtime: BuildHostHelpersRuntimeCtx,
): Promise<LlmResponse> {
  if (!req || typeof req !== "object") {
    throw new Error("llm: req must be an object");
  }
  if (typeof req.prompt !== "string" || req.prompt.length === 0) {
    throw new Error("llm: req.prompt is required (non-empty string)");
  }

  // Pre-flight budget check using the cheap estimator. This avoids a
  // round-trip to the LLM provider when the call would exceed budget.
  const remaining = deps.llm.tokenBudgetRemaining();
  if (remaining !== null) {
    const estimated = deps.llm.estimateInputTokens(req);
    if (estimated > remaining) {
      const err = new HookHelperError(
        HOOK_ERROR_CODES.HOOK_LLM_BUDGET_EXCEEDED,
        `LLM call would consume ~${estimated} tokens; only ${remaining} remaining`,
      );
      deps.onCallError?.("llm", err, {
        actorUserId: runtime.actorUserId,
        estimated,
        remaining,
      });
      throw err;
    }
  }

  let response: LlmResponse;
  try {
    response = await deps.llm.invoke(req);
  } catch (cause) {
    const err =
      cause instanceof HookHelperError
        ? cause
        : new Error(
            `llm: provider call failed: ${
              cause instanceof Error ? cause.message : String(cause)
            }`,
          );
    deps.onCallError?.("llm", err, { actorUserId: runtime.actorUserId });
    throw err;
  }

  deps.onCallSuccess?.("llm", {
    actorUserId: runtime.actorUserId,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  });
  return response;
}

// ─── fetchHandoff ──────────────────────────────────────────────────────────

async function fetchHandoffHelper(
  args: FetchHandoffArgs,
  deps: BuildHostHelpersDeps,
  runtime: BuildHostHelpersRuntimeCtx,
): Promise<string> {
  if (!args || typeof args !== "object") {
    throw new Error("fetchHandoff: args must be an object");
  }
  if (typeof args.git_sha !== "string" || args.git_sha.length === 0) {
    throw new Error("fetchHandoff: git_sha is required");
  }
  if (typeof args.path !== "string" || args.path.length === 0) {
    throw new Error("fetchHandoff: path is required");
  }
  // Pin the sha — refuse dynamic refs (TOCTOU). Restrict to a full hex
  // sha (40 chars for sha1, up to 64 for sha256). Lowercase only —
  // git canonicalises to lowercase, so an uppercase ref smells like
  // user-supplied input we should reject. The workflow's pinned sha is
  // also accepted by reference equality (covers any synthetic shape the
  // orchestrator may use for canonical refs in tests).
  if (
    !/^[0-9a-f]{40,64}$/.test(args.git_sha) &&
    args.git_sha !== runtime.workflowGitSha
  ) {
    throw new Error(
      "fetchHandoff: git_sha must be a hex sha or the run's pinned sha",
    );
  }
  return await deps.gitProvider.fetchBlob({
    path: args.path,
    ref: args.git_sha,
  });
}
