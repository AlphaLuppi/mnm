/**
 * Server-rendered OAuth consent screen — shows ALL granular permissions grouped by domain.
 */

import {
  PERMISSION_META,
  PERMISSION_CATEGORIES,
  MCP_SCOPES,
  permissionsForScopes,
  type McpScope,
  type PermissionSlug,
  type PermissionCategory,
} from "@mnm/shared";

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

const SCOPE_LABELS: Record<string, { label: string; description: string; warning?: string }> = {
  "mcp:read": { label: "Read", description: "View agents, issues, projects, traces, dashboards, and other data" },
  "mcp:write": { label: "Write", description: "Create and edit issues, agents, configs, workflows, and other resources" },
  "mcp:admin": { label: "Admin", description: "Delete resources, manage roles/tags, export audit logs", warning: "Includes destructive operations" },
};

const CATEGORY_LABELS: Record<string, string> = {
  agents: "Agents",
  issues: "Issues & Tasks",
  stories: "Stories",
  projects: "Projects",
  users: "Users",
  workflows: "Workflows",
  traces: "Traces & Observability",
  dashboard: "Dashboard",
  admin: "Administration",
  chat: "Chat",
  documents: "Documents",
  artifacts: "Artifacts",
  folders: "Folders",
  sandbox: "Sandbox",
  config: "Configuration",
  feedback: "Feedback",
  routines: "Routines",
  org: "Organisation",
  inbox: "Inbox",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPermissionsByCategory(scopes: McpScope[]): Map<PermissionCategory, Array<{ slug: PermissionSlug; description: string; destructive: boolean }>> {
  const granted = permissionsForScopes(scopes);
  const byCategory = new Map<PermissionCategory, Array<{ slug: PermissionSlug; description: string; destructive: boolean }>>();

  for (const slug of granted) {
    const meta = PERMISSION_META[slug];
    if (!meta) continue;
    const cat = meta.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push({ slug, description: meta.description, destructive: meta.destructive });
  }

  return byCategory;
}

export function renderConsentPage(params: ConsentPageParams): string {
  const requestedScopes = params.requestedScopes.filter((s): s is McpScope =>
    Object.values(MCP_SCOPES).includes(s as McpScope),
  );

  // Build scope checkboxes
  const scopeRows = requestedScopes.map((scope) => {
    const info = SCOPE_LABELS[scope];
    if (!info) return "";
    const isAdmin = scope === "mcp:admin";
    const checked = isAdmin ? "" : "checked";
    const warningBadge = info.warning
      ? `<span class="badge-warning">${escapeHtml(info.warning)}</span>`
      : "";
    const adminClass = isAdmin ? " scope-admin" : "";

    return `
      <label class="scope-item${adminClass}">
        <input type="checkbox" name="scopes" value="${escapeHtml(scope)}" ${checked} onchange="updatePermissions()" />
        <div>
          <div class="scope-label">${escapeHtml(info.label)}${warningBadge}</div>
          <div class="scope-desc">${escapeHtml(info.description)}</div>
        </div>
      </label>`;
  }).join("\n");

  // Build permissions by category for ALL possible scopes (JS will toggle visibility)
  const allPermsByScope: Record<string, Record<string, Array<{ slug: string; description: string; destructive: boolean }>>> = {};
  for (const scope of Object.values(MCP_SCOPES)) {
    const perms = buildPermissionsByCategory([scope]);
    const obj: Record<string, Array<{ slug: string; description: string; destructive: boolean }>> = {};
    for (const [cat, items] of perms) {
      obj[cat] = items;
    }
    allPermsByScope[scope] = obj;
  }

  // Build initial permission display (for default checked scopes)
  const defaultScopes = requestedScopes.filter(s => s !== "mcp:admin") as McpScope[];
  const defaultPerms = buildPermissionsByCategory(defaultScopes);

  const categoryOrder = PERMISSION_CATEGORIES.filter(c => {
    // Show categories that have at least one permission in any scope
    for (const scope of Object.values(MCP_SCOPES)) {
      const perms = allPermsByScope[scope];
      if (perms && perms[c] && perms[c].length > 0) return true;
    }
    return false;
  });

  const permissionSections = categoryOrder.map((cat) => {
    const label = CATEGORY_LABELS[cat] || cat;
    const perms = defaultPerms.get(cat) || [];
    const permRows = perms.map(p => {
      const destructiveClass = p.destructive ? ' class="perm-destructive"' : "";
      return `<li${destructiveClass}><code>${escapeHtml(p.slug)}</code> — ${escapeHtml(p.description)}</li>`;
    }).join("\n");

    return `
      <div class="category" data-category="${escapeHtml(cat)}">
        <div class="category-header" onclick="this.parentElement.classList.toggle('collapsed')">
          <span class="category-arrow">▼</span>
          <strong>${escapeHtml(label)}</strong>
          <span class="perm-count" data-cat="${escapeHtml(cat)}">${perms.length}</span>
        </div>
        <ul class="perm-list" data-cat="${escapeHtml(cat)}">
          ${permRows || '<li class="perm-none">No permissions in this scope</li>'}
        </ul>
      </div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authorize ${escapeHtml(params.clientName)} — MnM</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; display: flex; justify-content: center; padding: 32px 16px; min-height: 100vh; }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 600px; width: 100%; padding: 32px; }
    h1 { font-size: 1.25rem; margin-bottom: 4px; }
    .subtitle { color: #6b7280; font-size: 0.9rem; margin-bottom: 24px; }
    .section-title { font-size: 0.85rem; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }

    /* Scope checkboxes */
    .scopes { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
    .scope-item { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: border-color 0.15s; }
    .scope-item:hover { border-color: #93c5fd; }
    .scope-item input { margin-top: 3px; }
    .scope-label { font-weight: 600; font-size: 0.95rem; }
    .scope-desc { color: #6b7280; font-size: 0.85rem; margin-top: 2px; }
    .scope-admin { border-color: #fbbf24; background: #fffbeb; }
    .badge-warning { display: inline-block; background: #f59e0b; color: #fff; font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; margin-left: 8px; font-weight: 500; }

    /* Permission details */
    .permissions { border: 1px solid #e5e7eb; border-radius: 8px; max-height: 400px; overflow-y: auto; margin-bottom: 24px; }
    .category { border-bottom: 1px solid #f3f4f6; }
    .category:last-child { border-bottom: none; }
    .category-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; cursor: pointer; user-select: none; font-size: 0.9rem; }
    .category-header:hover { background: #f9fafb; }
    .category-arrow { font-size: 0.7rem; color: #9ca3af; transition: transform 0.15s; }
    .category.collapsed .category-arrow { transform: rotate(-90deg); }
    .category.collapsed .perm-list { display: none; }
    .perm-count { font-size: 0.75rem; background: #e5e7eb; color: #374151; padding: 1px 7px; border-radius: 10px; margin-left: auto; }
    .perm-list { list-style: none; padding: 0 14px 10px 36px; }
    .perm-list li { font-size: 0.82rem; color: #4b5563; padding: 3px 0; }
    .perm-list code { font-size: 0.78rem; background: #f3f4f6; padding: 1px 5px; border-radius: 3px; }
    .perm-destructive code { background: #fef2f2; color: #dc2626; }
    .perm-none { color: #9ca3af; font-style: italic; }

    /* Actions */
    .actions { display: flex; gap: 12px; }
    .btn { flex: 1; padding: 10px 16px; border-radius: 8px; font-size: 0.95rem; font-weight: 500; cursor: pointer; border: 1px solid #d1d5db; background: #fff; color: #374151; text-align: center; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
    .btn-primary { background: #2563eb; color: #fff; border-color: #2563eb; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn:hover { background: #f3f4f6; }

    .total-count { font-size: 0.85rem; color: #6b7280; margin-bottom: 16px; }
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

      <p class="section-title">Scopes requested</p>
      <div class="scopes">
        ${scopeRows}
      </div>

      <p class="section-title">Permissions granted</p>
      <p class="total-count" id="total-count"></p>
      <div class="permissions" id="permissions-container">
        ${permissionSections}
      </div>

      <div class="actions">
        <a href="${escapeHtml(params.redirectUri)}?error=access_denied${params.state ? `&state=${escapeHtml(params.state)}` : ""}" class="btn">Deny</a>
        <button type="submit" class="btn btn-primary">Authorize</button>
      </div>
    </form>
  </div>

  <script>
    // Permission data by scope (generated server-side)
    const permsByScope = ${JSON.stringify(allPermsByScope)};
    const categoryLabels = ${JSON.stringify(CATEGORY_LABELS)};

    function updatePermissions() {
      const checked = Array.from(document.querySelectorAll('input[name="scopes"]:checked')).map(el => el.value);

      // Merge permissions from all checked scopes
      const merged = {};
      for (const scope of checked) {
        const perms = permsByScope[scope] || {};
        for (const [cat, items] of Object.entries(perms)) {
          if (!merged[cat]) merged[cat] = [];
          for (const item of items) {
            if (!merged[cat].some(p => p.slug === item.slug)) {
              merged[cat].push(item);
            }
          }
        }
      }

      // Update each category
      let totalCount = 0;
      const container = document.getElementById('permissions-container');
      const categories = container.querySelectorAll('.category');

      for (const catEl of categories) {
        const cat = catEl.dataset.category;
        const perms = merged[cat] || [];
        const list = catEl.querySelector('.perm-list');
        const countEl = catEl.querySelector('.perm-count');

        totalCount += perms.length;
        countEl.textContent = perms.length;

        if (perms.length === 0) {
          list.innerHTML = '<li class="perm-none">No permissions in this scope</li>';
          catEl.style.opacity = '0.5';
        } else {
          list.innerHTML = perms.map(p => {
            const cls = p.destructive ? ' class="perm-destructive"' : '';
            return '<li' + cls + '><code>' + p.slug + '</code> — ' + p.description + '</li>';
          }).join('');
          catEl.style.opacity = '1';
        }
      }

      document.getElementById('total-count').textContent = totalCount + ' permissions will be granted';
    }

    // Initial update
    updatePermissions();
  </script>
</body>
</html>`;
}
