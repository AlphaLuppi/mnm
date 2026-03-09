export const ALLOWED_DOMAINS = [
  "api.anthropic.com",
  "github.com",
  "api.github.com",
] as const;

export function isAllowedDomain(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.some(
      (domain) =>
        parsed.hostname === domain ||
        parsed.hostname.endsWith("." + domain)
    );
  } catch {
    return false;
  }
}
