/**
 * Server-rendered OAuth consent screen — permissions grouped by domain.
 * Each domain shows its read/write/admin permissions individually.
 */

import {
  PERMISSION_META,
  PERMISSION_CATEGORIES,
  ALL_PERMISSION_SLUGS,
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
  /** User's actual role permissions — if provided, only show permissions the user has. */
  userPermissions: string[] | null;
}

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

const CATEGORY_ICONS: Record<string, string> = {
  agents: "🤖",
  issues: "📋",
  stories: "📖",
  projects: "📁",
  users: "👥",
  workflows: "⚙️",
  traces: "📊",
  dashboard: "📈",
  admin: "🔒",
  chat: "💬",
  documents: "📄",
  artifacts: "📦",
  folders: "🗂️",
  sandbox: "🐳",
  config: "⚡",
  feedback: "💡",
  routines: "🔄",
  org: "🏢",
  inbox: "📥",
};

/** Classify a permission as read, write, or admin based on its properties. */
function classifyPermission(slug: PermissionSlug): "read" | "write" | "admin" {
  const meta = PERMISSION_META[slug];
  if (meta.destructive) return "admin";
  if (
    slug.endsWith(":read") || slug.endsWith(":view") ||
    slug === "dashboard:view" || slug === "org:view" || slug === "inbox:read"
  ) return "read";
  return "write";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Action label for permission slug (e.g. "agents:create" → "Create"). */
function actionLabel(slug: string): string {
  const action = slug.split(":")[1] ?? slug;
  return action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, " ");
}

interface DomainPermissions {
  category: PermissionCategory;
  label: string;
  icon: string;
  read: Array<{ slug: PermissionSlug; description: string; action: string }>;
  write: Array<{ slug: PermissionSlug; description: string; action: string }>;
  admin: Array<{ slug: PermissionSlug; description: string; action: string }>;
}

function buildDomainPermissions(userPermissions: Set<string> | null): DomainPermissions[] {
  const domains: DomainPermissions[] = [];

  for (const cat of PERMISSION_CATEGORIES) {
    // Filter to only permissions the user actually has (if provided)
    const perms = ALL_PERMISSION_SLUGS.filter(s => {
      if (PERMISSION_META[s].category !== cat) return false;
      if (userPermissions && !userPermissions.has(s)) return false;
      return true;
    });
    if (perms.length === 0) continue;

    const domain: DomainPermissions = {
      category: cat,
      label: CATEGORY_LABELS[cat] ?? cat,
      icon: CATEGORY_ICONS[cat] ?? "📌",
      read: [],
      write: [],
      admin: [],
    };

    for (const slug of perms) {
      const tier = classifyPermission(slug);
      domain[tier].push({
        slug,
        description: PERMISSION_META[slug].description,
        action: actionLabel(slug),
      });
    }

    domains.push(domain);
  }

  return domains;
}

function renderTierBlock(
  tier: "read" | "write" | "admin",
  perms: Array<{ slug: PermissionSlug; description: string; action: string }>,
  scopeValue: string,
  defaultChecked: boolean,
  cat: string,
): string {
  if (perms.length === 0) return "";

  const tierLabels = { read: "Read", write: "Write", admin: "Admin" };
  const tierColors = { read: "#059669", write: "#2563eb", admin: "#dc2626" };
  const tierBg = { read: "#ecfdf5", write: "#eff6ff", admin: "#fef2f2" };
  const checked = defaultChecked ? "checked" : "";

  const permList = perms.map(p =>
    `<li><code>${escapeHtml(p.slug)}</code> <span class="perm-desc">— ${escapeHtml(p.description)}</span></li>`,
  ).join("\n");

  return `
    <div class="tier-block" style="border-left: 3px solid ${tierColors[tier]}; background: ${tierBg[tier]};">
      <label class="tier-header">
        <input type="checkbox" name="scopes" value="${escapeHtml(scopeValue)}" data-tier="${tier}" data-cat="${escapeHtml(cat)}" ${checked} />
        <span class="tier-label" style="color: ${tierColors[tier]};">${tierLabels[tier]}</span>
        <span class="tier-count">${perms.length}</span>
      </label>
      <ul class="tier-perms">${permList}</ul>
    </div>`;
}

export function renderConsentPage(params: ConsentPageParams): string {
  const userPermsSet = params.userPermissions ? new Set(params.userPermissions) : null;
  const domains = buildDomainPermissions(userPermsSet);

  const domainSections = domains.map(domain => {
    const readBlock = renderTierBlock("read", domain.read, "mcp:read", true, domain.category);
    const writeBlock = renderTierBlock("write", domain.write, "mcp:write", true, domain.category);
    const adminBlock = renderTierBlock("admin", domain.admin, "mcp:admin", false, domain.category);
    const totalPerms = domain.read.length + domain.write.length + domain.admin.length;

    return `
      <div class="domain">
        <div class="domain-header" onclick="this.parentElement.classList.toggle('collapsed')">
          <span class="domain-icon">${domain.icon}</span>
          <span class="domain-label">${escapeHtml(domain.label)}</span>
          <span class="domain-count">${totalPerms}</span>
          <span class="domain-arrow">▼</span>
        </div>
        <div class="domain-body">
          ${readBlock}${writeBlock}${adminBlock}
        </div>
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
    .card { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 680px; width: 100%; padding: 32px; }
    h1 { font-size: 1.25rem; margin-bottom: 4px; }
    .subtitle { color: #6b7280; font-size: 0.9rem; margin-bottom: 20px; }

    /* Master toggles */
    .master-toggles { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .master-btn { padding: 6px 14px; border-radius: 6px; font-size: 0.82rem; font-weight: 500; cursor: pointer; border: 1px solid #d1d5db; background: #fff; transition: all 0.15s; }
    .master-btn.active { color: #fff; }
    .master-btn[data-tier="read"].active { background: #059669; border-color: #059669; }
    .master-btn[data-tier="write"].active { background: #2563eb; border-color: #2563eb; }
    .master-btn[data-tier="admin"].active { background: #dc2626; border-color: #dc2626; }

    /* Domains */
    .domains { border: 1px solid #e5e7eb; border-radius: 8px; max-height: 500px; overflow-y: auto; margin-bottom: 20px; }
    .domain { border-bottom: 1px solid #e5e7eb; }
    .domain:last-child { border-bottom: none; }
    .domain-header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; cursor: pointer; user-select: none; }
    .domain-header:hover { background: #f9fafb; }
    .domain-icon { font-size: 1.1rem; }
    .domain-label { font-weight: 600; font-size: 0.92rem; flex: 1; }
    .domain-count { font-size: 0.72rem; background: #e5e7eb; color: #374151; padding: 1px 7px; border-radius: 10px; }
    .domain-arrow { font-size: 0.65rem; color: #9ca3af; transition: transform 0.15s; }
    .domain.collapsed .domain-arrow { transform: rotate(-90deg); }
    .domain.collapsed .domain-body { display: none; }
    .domain-body { padding: 0 14px 12px; display: flex; flex-direction: column; gap: 6px; }

    /* Tier blocks (read/write/admin within a domain) */
    .tier-block { border-radius: 6px; padding: 8px 10px; }
    .tier-header { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.85rem; }
    .tier-label { font-weight: 600; font-size: 0.82rem; }
    .tier-count { font-size: 0.7rem; color: #6b7280; }
    .tier-perms { list-style: none; padding: 4px 0 0 26px; }
    .tier-perms li { font-size: 0.78rem; color: #4b5563; padding: 2px 0; }
    .tier-perms code { font-size: 0.74rem; background: rgba(0,0,0,0.04); padding: 1px 5px; border-radius: 3px; }
    .perm-desc { color: #6b7280; }

    /* Actions */
    .actions { display: flex; gap: 12px; }
    .btn { flex: 1; padding: 10px 16px; border-radius: 8px; font-size: 0.95rem; font-weight: 500; cursor: pointer; border: 1px solid #d1d5db; background: #fff; color: #374151; text-align: center; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
    .btn-primary { background: #2563eb; color: #fff; border-color: #2563eb; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn:hover { background: #f3f4f6; }

    .summary { font-size: 0.82rem; color: #6b7280; margin-bottom: 16px; text-align: center; }
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

      <!-- Master toggles -->
      <div class="master-toggles">
        <button type="button" class="master-btn active" data-tier="read" onclick="toggleTier('read', this)">✅ Read access</button>
        <button type="button" class="master-btn active" data-tier="write" onclick="toggleTier('write', this)">✅ Write access</button>
        <button type="button" class="master-btn" data-tier="admin" onclick="toggleTier('admin', this)">⛔ Admin access</button>
      </div>

      <p class="summary" id="summary"></p>

      <!-- Domain list -->
      <div class="domains">
        ${domainSections}
      </div>

      <div class="actions">
        <a href="${escapeHtml(params.redirectUri)}?error=access_denied${params.state ? `&state=${escapeHtml(params.state)}` : ""}" class="btn">Deny</a>
        <button type="submit" class="btn btn-primary">Authorize</button>
      </div>
    </form>
  </div>

  <script>
    function toggleTier(tier, btn) {
      const isActive = btn.classList.toggle('active');
      // Toggle all checkboxes for this tier
      document.querySelectorAll('input[data-tier="' + tier + '"]').forEach(cb => {
        cb.checked = isActive;
      });
      updateSummary();
    }

    function updateSummary() {
      const checked = document.querySelectorAll('input[name="scopes"]:checked');
      const scopes = new Set();
      checked.forEach(cb => scopes.add(cb.value));
      const count = checked.length;

      // Update master buttons state
      ['read', 'write', 'admin'].forEach(tier => {
        const all = document.querySelectorAll('input[data-tier="' + tier + '"]');
        const checkedInTier = document.querySelectorAll('input[data-tier="' + tier + '"]:checked');
        const btn = document.querySelector('.master-btn[data-tier="' + tier + '"]');
        if (checkedInTier.length === all.length && all.length > 0) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // Count unique permissions
      let permCount = 0;
      checked.forEach(() => permCount++);

      const scopeList = [];
      if (scopes.has('mcp:read')) scopeList.push('read');
      if (scopes.has('mcp:write')) scopeList.push('write');
      if (scopes.has('mcp:admin')) scopeList.push('admin');

      document.getElementById('summary').textContent =
        scopeList.length > 0
          ? 'Scopes: ' + scopeList.join(', ') + ' — ' + permCount + ' domain grants selected'
          : 'No access selected';
    }

    // Individual checkbox change
    document.querySelectorAll('input[name="scopes"]').forEach(cb => {
      cb.addEventListener('change', updateSummary);
    });

    updateSummary();
  </script>
</body>
</html>`;
}
