/**
 * CONNECTORS-PLATFORM Sprint 2 — 10 connector templates pré-définis.
 *
 * Public, read-only metadata. Used by the admin UI to spawn a wizard with
 * pre-filled defaults. The admin still needs to provide a `client_id` +
 * `client_secret` (OAuth) or just confirm an `api_key_label` (API key flow).
 *
 * Stored client-side (sent over `GET /connectors/templates`) — no secret
 * material. Server-side validation re-checks every URL on create.
 */

export type ConnectorTemplateType = "oauth2" | "api_key";

export interface ConnectorTemplate {
  /** Stable identifier — also the default `provider_slug` an admin will pick. */
  slug: string;
  /** Human-readable label (FR — UI is FR per CLAUDE.md). */
  displayName: string;
  /** "oauth2" or "api_key". */
  type: ConnectorTemplateType;
  /** Short tagline for the template card. */
  tagline: string;
  /** Logo identifier (resolved client-side via lucide-react or a sprite). */
  icon: string;
  /** Recommended scopes (OAuth) — pre-checked in the wizard. */
  scopes?: string[];
  /** Authorize URL (OAuth) — admin can override per-instance. */
  authorizationUrl?: string;
  /** Token URL (OAuth). */
  tokenUrl?: string;
  /** UserInfo / "me" URL (OAuth, optional). */
  userinfoUrl?: string;
  /** Refresh-token supported by provider? Defaults to true. */
  refreshSupported?: boolean;
  /** API key label for api_key connectors (e.g. "OPENAI_API_KEY"). */
  apiKeyLabel?: string;
  /** Public docs link (FR or EN — admin sets up an OAuth app on the provider). */
  docsUrl?: string;
}

export const CONNECTOR_TEMPLATES: readonly ConnectorTemplate[] = [
  {
    slug: "jira",
    displayName: "Jira",
    type: "oauth2",
    tagline: "Atlassian Jira Cloud — issues, projects, sprints",
    icon: "jira",
    scopes: ["read:jira-user", "read:jira-work", "write:jira-work", "offline_access"],
    authorizationUrl: "https://auth.atlassian.com/authorize",
    tokenUrl: "https://auth.atlassian.com/oauth/token",
    userinfoUrl: "https://api.atlassian.com/me",
    refreshSupported: true,
    docsUrl: "https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/",
  },
  {
    slug: "github",
    displayName: "GitHub",
    type: "oauth2",
    tagline: "GitHub.com — repos, issues, PRs",
    icon: "github",
    scopes: ["repo", "read:user", "user:email"],
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userinfoUrl: "https://api.github.com/user",
    // GitHub OAuth Apps don't issue refresh_tokens (GitHub Apps do, but they're a different flow).
    refreshSupported: false,
    docsUrl: "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app",
  },
  {
    slug: "gitlab",
    displayName: "GitLab",
    type: "oauth2",
    tagline: "GitLab.com / self-managed — repos, issues, MR",
    icon: "gitlab",
    scopes: ["api", "read_user", "read_repository", "write_repository"],
    authorizationUrl: "https://gitlab.com/oauth/authorize",
    tokenUrl: "https://gitlab.com/oauth/token",
    userinfoUrl: "https://gitlab.com/api/v4/user",
    refreshSupported: true,
    docsUrl: "https://docs.gitlab.com/ee/integration/oauth_provider.html",
  },
  {
    slug: "microsoft",
    displayName: "Microsoft 365",
    type: "oauth2",
    tagline: "Microsoft Graph — Outlook, Teams, OneDrive",
    icon: "microsoft",
    scopes: ["openid", "profile", "email", "offline_access", "User.Read"],
    authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userinfoUrl: "https://graph.microsoft.com/v1.0/me",
    refreshSupported: true,
    docsUrl: "https://learn.microsoft.com/en-us/graph/auth-v2-user",
  },
  {
    slug: "google",
    displayName: "Google Workspace",
    type: "oauth2",
    tagline: "Google Workspace — Calendar, Gmail, Drive",
    icon: "google",
    scopes: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userinfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    refreshSupported: true,
    docsUrl: "https://developers.google.com/identity/protocols/oauth2",
  },
  {
    slug: "slack",
    displayName: "Slack",
    type: "oauth2",
    tagline: "Slack — channels, messages, search",
    icon: "slack",
    scopes: ["channels:read", "chat:write", "users:read"],
    authorizationUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    userinfoUrl: "https://slack.com/api/users.identity",
    // Slack v2 issues a long-lived bot token by default (no refresh).
    refreshSupported: false,
    docsUrl: "https://api.slack.com/authentication/oauth-v2",
  },
  {
    slug: "clickup",
    displayName: "ClickUp",
    type: "oauth2",
    tagline: "ClickUp — tasks, lists, spaces",
    icon: "clickup",
    scopes: [],
    authorizationUrl: "https://app.clickup.com/api",
    tokenUrl: "https://api.clickup.com/api/v2/oauth/token",
    userinfoUrl: "https://api.clickup.com/api/v2/user",
    refreshSupported: false,
    docsUrl: "https://clickup.com/api/developer-portal/authentication/",
  },
  {
    slug: "linear",
    displayName: "Linear",
    type: "oauth2",
    tagline: "Linear — issues, projects, cycles",
    icon: "linear",
    scopes: ["read", "write"],
    authorizationUrl: "https://linear.app/oauth/authorize",
    tokenUrl: "https://api.linear.app/oauth/token",
    userinfoUrl: "https://api.linear.app/graphql",
    refreshSupported: false,
    docsUrl: "https://developers.linear.app/docs/oauth/authentication",
  },
  {
    slug: "notion",
    displayName: "Notion",
    type: "oauth2",
    tagline: "Notion — pages, databases, blocks",
    icon: "notion",
    scopes: [],
    authorizationUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    userinfoUrl: "https://api.notion.com/v1/users/me",
    refreshSupported: false,
    docsUrl: "https://developers.notion.com/docs/authorization",
  },
  {
    slug: "openai",
    displayName: "OpenAI",
    type: "api_key",
    tagline: "OpenAI — GPT-4, GPT-4o, embeddings",
    icon: "openai",
    apiKeyLabel: "OPENAI_API_KEY",
    docsUrl: "https://platform.openai.com/api-keys",
  },
] as const;

export function findTemplate(slug: string): ConnectorTemplate | undefined {
  return CONNECTOR_TEMPLATES.find((t) => t.slug === slug);
}
