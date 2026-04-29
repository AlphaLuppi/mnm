/**
 * safeHref — protocol-allowlist guard for user-controlled URLs (SEC-T4-04, SEC-T4-05, SEC-T4-06).
 *
 * Blocks javascript:, data:text/html, vbscript:, and any other non-safe
 * protocol by only allowing the explicit allowlist below.
 *
 * Returns undefined when the URL is falsy or fails the check, so callers
 * can safely write `href={safeHref(url)}` — React omits the attribute when
 * the value is undefined, which makes the anchor inert rather than dangerous.
 */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(url) ? url : undefined;
}

/**
 * safeExternalHref — stricter variant for URLs that must be absolute external
 * links (deployment URLs, login URLs).  Rejects relative paths and bare
 * anchors — only https:// and http:// are accepted.
 */
export function safeExternalHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : undefined;
}
