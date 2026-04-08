/**
 * Server-rendered OAuth consent screen (Phase 1 — no React).
 */

export interface ConsentPageParams {
  clientName: string;
  requestedScopes: string[];
  clientId: string;
  redirectUri: string;
  state?: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource?: string;
  csrfToken: string;
}

const SCOPE_INFO: Record<string, { label: string; description: string; defaultChecked: boolean; warning?: string }> = {
  "mcp:read": {
    label: "mcp:read",
    description: "View agents, issues, projects, traces, and dashboards",
    defaultChecked: true,
  },
  "mcp:write": {
    label: "mcp:write",
    description: "Create and edit issues, agents, configs, and workflows",
    defaultChecked: true,
  },
  "mcp:admin": {
    label: "mcp:admin",
    description: "Delete resources, manage roles/tags, export audit logs",
    defaultChecked: false,
    warning: "Grants destructive permissions",
  },
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderConsentPage(params: ConsentPageParams): string {
  const scopeRows = params.requestedScopes.map((scope) => {
    const info = SCOPE_INFO[scope];
    if (!info) return "";
    const checked = info.defaultChecked ? "checked" : "";
    const warningBadge = info.warning
      ? `<span style="display:inline-block;background:#f59e0b;color:#fff;font-size:0.75rem;padding:2px 8px;border-radius:4px;margin-left:8px;">${escapeHtml(info.warning)}</span>`
      : "";

    return `
      <label style="display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;cursor:pointer;">
        <input type="checkbox" name="scopes" value="${escapeHtml(scope)}" ${checked} style="margin-top:3px;" />
        <div>
          <div style="font-weight:600;font-size:0.95rem;">
            ${escapeHtml(info.label)}${warningBadge}
          </div>
          <div style="color:#6b7280;font-size:0.85rem;margin-top:2px;">
            ${escapeHtml(info.description)}
          </div>
        </div>
      </label>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authorize ${escapeHtml(params.clientName)} — MnM</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 440px; width: 100%; padding: 32px; }
    h1 { font-size: 1.25rem; margin-bottom: 4px; }
    .subtitle { color: #6b7280; font-size: 0.9rem; margin-bottom: 24px; }
    .scopes { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
    .actions { display: flex; gap: 12px; }
    .btn { flex: 1; padding: 10px 16px; border-radius: 8px; font-size: 0.95rem; font-weight: 500; cursor: pointer; border: 1px solid #d1d5db; background: #fff; color: #374151; text-align: center; }
    .btn-primary { background: #2563eb; color: #fff; border-color: #2563eb; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn:hover { background: #f3f4f6; }
    .btn-primary:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize ${escapeHtml(params.clientName)}</h1>
    <p class="subtitle">This application is requesting access to your MnM account.</p>

    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}" />
      <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}" />
      <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}" />
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.codeChallengeMethod)}" />
      ${params.state ? `<input type="hidden" name="state" value="${escapeHtml(params.state)}" />` : ""}
      ${params.resource ? `<input type="hidden" name="resource" value="${escapeHtml(params.resource)}" />` : ""}
      <input type="hidden" name="csrf_token" value="${escapeHtml(params.csrfToken)}" />
      <input type="hidden" name="consent" value="approve" />

      <div class="scopes">
        ${scopeRows}
      </div>

      <div class="actions">
        <a href="${escapeHtml(params.redirectUri)}?error=access_denied${params.state ? `&state=${escapeHtml(params.state)}` : ""}" class="btn">Deny</a>
        <button type="submit" class="btn btn-primary">Authorize</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}
