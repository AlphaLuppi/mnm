/**
 * MnM Web/Desktop Parity Tracker — Source of Truth
 *
 * This file tracks every user-facing feature and its status on each platform.
 * Update it whenever you add, modify, or port a feature. Run `bun run parity`
 * to see the rendered report.
 *
 * See docs/parity.md (or CLAUDE.md § "Web/Desktop Parity Tracking") for the
 * full maintenance contract.
 */

export type FeatureStatus =
  | "done" // Fully implemented and verified working in packaged/prod build
  | "dev-only" // Works in dev mode, not yet verified (or broken) in packaged build
  | "partial" // Implemented but has known gaps — see `notes`
  | "missing" // Not implemented yet
  | "n/a"; // Not applicable to this platform

export interface PlatformState {
  status: FeatureStatus;
  since?: string; // Version where this status became true (e.g. "0.1.0")
  notes?: string; // One-liner clarification
  blockers?: string[]; // Free-text blocker tags (reference shared blockers below)
}

export interface TodoList {
  tests?: string[]; // Tests still needed (unit, e2e, smoke)
  config?: string[]; // Config/build work needed
  code?: string[]; // Code changes required
  notes?: string[]; // Other considerations
}

export interface Feature {
  id: string;
  name: string;
  description?: string;
  web: PlatformState;
  desktop: PlatformState;
  /** What's needed to bring desktop to parity (or vice-versa) */
  todo?: TodoList;
}

export interface Domain {
  id: string;
  name: string;
  features: Feature[];
}

export interface ParityData {
  version: number;
  generated: string; // ISO date, refresh when seeding large updates
  webVersion: string;
  desktopVersion: string;
  sharedBlockers: Record<string, string>; // id → human description
  domains: Domain[];
}

/**
 * Shared blocker tags — reference these in `blockers` arrays instead of
 * repeating the same free-text string across dozens of features.
 *
 * Architectural note (2026-04-11): the desktop DMG ships as a thin client.
 * It never bundles or spawns a backend — users install the backend separately
 * from the (private) repo (docker compose / bun). Sandbox stays colocated
 * with the backend (heartbeat → `docker exec`), never on the desktop user's
 * machine. The desktop's job is purely: pick a profile, store creds in
 * Keychain, talk to the chosen instance.
 */
const BLOCKERS = {
  "desktop-connection-profiles":
    "Desktop needs a connection-profile system (URL config per profile + session token in Keychain + strict CSP resolved from the active profile). Blocks every feature that talks to a backend in a packaged DMG. Tracked in the `connection-profiles` domain.",
  "desktop-sse-connectivity":
    "Live events (SSE/WebSocket) not yet verified inside a packaged DMG — unblocks once connection-profiles lands.",
  "desktop-packaged-verification":
    "Feature works in `bun run dev:desktop` (Vite proxy) but has never been exercised inside a signed/packaged DMG.",
  "desktop-codesign-notarization":
    "Sprint 2 milestone — no Apple Developer ID signing or notarization yet; Gatekeeper blocks first launch.",
} as const satisfies Record<string, string>;

// Convenient short-hands so features below stay readable
const BACKEND: PlatformState = {
  status: "dev-only",
  since: "0.1.1",
  blockers: ["desktop-connection-profiles", "desktop-packaged-verification"],
};
const BACKEND_SSE: PlatformState = {
  status: "dev-only",
  since: "0.1.1",
  blockers: [
    "desktop-connection-profiles",
    "desktop-sse-connectivity",
    "desktop-packaged-verification",
  ],
};
const WEB_DONE: PlatformState = { status: "done", since: "0.1.0" };
const WEB_NA: PlatformState = { status: "n/a" };
const DESKTOP_MISSING: PlatformState = { status: "missing" };

export const parityData: ParityData = {
  version: 1,
  generated: "2026-04-11",
  webVersion: "0.0.1",
  desktopVersion: "0.1.1",
  sharedBlockers: BLOCKERS,
  domains: [
    {
      id: "auth",
      name: "Authentication & Onboarding",
      features: [
        {
          id: "signup-auto-bootstrap",
          name: "First-user signup with auto-promotion to instance_admin",
          description:
            "Better Auth databaseHooks auto-promotes the first signup (SANDBOX-AUTH-AUTOBOOTSTRAP).",
          web: WEB_DONE,
          desktop: BACKEND,
          todo: {
            tests: ["E2E: signup → auto-admin inside packaged DMG against a real instance"],
          },
        },
        {
          id: "signin-signout",
          name: "Sign in / sign out",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "onboarding-wizard",
          name: "Onboarding wizard (dual-mode, invite, progress)",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "invite-landing",
          name: "Invite landing page (magic link)",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "board-claim",
          name: "Board claim flow (public token → join)",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "sso-config",
          name: "SSO provider configuration (admin)",
          web: WEB_DONE,
          desktop: BACKEND,
        },
      ],
    },
    {
      id: "dashboard",
      name: "Dashboard & Overview",
      features: [
        {
          id: "dashboard-kpis",
          name: "Dashboard — KPI cards, grid, timeline, widgets",
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
        {
          id: "activity-feed",
          name: "Activity feed + charts",
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
        {
          id: "costs-view",
          name: "Costs dashboard",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "command-palette",
          name: "Command palette (⌘K)",
          web: WEB_DONE,
          desktop: {
            status: "partial",
            since: "0.1.1",
            notes: "Works in shared UI but Tauri global shortcuts not yet wired",
          },
          todo: {
            code: [
              "Register global ⌘K via tauri-plugin-global-shortcut for in-window focus",
              "Optional: Cmd+Shift+M system-wide quick prompt (Sprint 3)",
            ],
          },
        },
      ],
    },
    {
      id: "agents",
      name: "Agents",
      features: [
        {
          id: "agents-list",
          name: "Agents list (all / active / paused / error tabs)",
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
        {
          id: "agent-detail",
          name: "Agent detail (properties, runs, chat, config)",
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
        {
          id: "new-agent",
          name: "New agent creation flow",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "agent-chat-panel",
          name: "Live agent chat panel",
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
        {
          id: "agent-config-layers",
          name: "Config layers (priority merge, advisory locks)",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "cao-supervisor",
          name: "CAO (Chief Agent Officer) watchdog + @cao mentions",
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
      ],
    },
    {
      id: "issues",
      name: "Issues & Inbox",
      features: [
        {
          id: "issues-list",
          name: "Issues list with filters (active, backlog, done, recent)",
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
        {
          id: "issue-detail",
          name: "Issue detail — comments, status, assignment",
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
        {
          id: "inbox",
          name: "Inbox (new / all tabs)",
          description:
            "Inbox aggregates approvals, failed runs, alerts, stale work, agent notifications, join requests, my recent issues, and (T3.5) pending workflow-step assignments. SSE-driven, no polling.",
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
        {
          id: "jira-import",
          name: "Jira import",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          // PAPERCLIP-PHASE2 — port of upstream PRs #4244 + #4381
          id: "thread-interactions",
          name: "Inbox Interactive — structured agent <-> user cards (suggest_tasks / ask_questions / request_confirmation)",
          description:
            "Structured cards in the issue thread with idempotency keys, resumable tokens, and live SSE refresh. " +
            "Replaces 'agent asks yes/no in markdown' with explicit accept/reject UI. Backend + REST + 3 MCP tools shipped; UI in stub state.",
          web: { status: "partial", since: "0.1.x", notes: "Hook + InteractionCard stub; multi-question forms and document target preview pending." },
          desktop: BACKEND_SSE,
          todo: {
            code: [
              "Polish: rich markdown body, multi-question form, suggested-task tree preview",
              "Wire LiveUpdatesProvider to dispatch `thread_interaction:updated` DOM events",
              "Plug InteractionCard into IssueDetail comment thread",
              "Implement supersedeOnUserComment hook (issueComments insert → svc.supersede)",
            ],
            tests: ["E2E: agent propose → user accept → child issues created"],
          },
        },
      ],
    },
    {
      id: "projects-goals",
      name: "Projects & Goals",
      features: [
        {
          id: "projects-list",
          name: "Projects list",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "project-detail",
          name: "Project detail (overview, cockpit, agents, workflows, settings, drift, access)",
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
        {
          id: "goals-tree",
          name: "Goals tree + goal detail",
          web: WEB_DONE,
          desktop: BACKEND,
        },
      ],
    },
    {
      id: "workflows",
      name: "Workflows & Routines",
      features: [
        {
          id: "workflows-list",
          name: "Workflows list",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "workflow-detail",
          name: "Workflow detail + traces",
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
        {
          id: "workflow-editor",
          name: "Visual workflow editor",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "routines",
          name: "Routines list + detail",
          web: WEB_DONE,
          desktop: BACKEND,
        },
      ],
    },
    {
      id: "traces",
      name: "Traces (Gold / Silver / Bronze pipeline)",
      features: [
        {
          id: "traces-list",
          name: "Traces list",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "trace-detail-gold",
          name: "Trace detail — Gold view (default)",
          description: "Auto-generated scored phases, annotations, verdicts.",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "trace-detail-silver-bronze",
          name: "Trace detail — Silver/Bronze debug views",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "trace-timeline-demo",
          name: "Trace timeline demo page",
          web: WEB_DONE,
          desktop: { status: "dev-only", since: "0.1.1" },
        },
        {
          id: "trace-lens-settings",
          name: "Trace lens settings (admin)",
          web: WEB_DONE,
          desktop: BACKEND,
        },
      ],
    },
    {
      id: "chat-folders",
      name: "Chat & Folders",
      features: [
        {
          id: "chat-channels",
          name: "Chat channels",
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
        {
          id: "shared-chat",
          name: "Publicly shared chat (token)",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "folders",
          name: "Folders — list, detail, workspace",
          web: WEB_DONE,
          desktop: BACKEND,
        },
      ],
    },
    {
      id: "approvals-deployments",
      name: "Approvals, Deployments & Drift",
      features: [
        {
          id: "approvals",
          name: "Approvals (pending / all / detail)",
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
        {
          id: "deployments",
          name: "Deployments view",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "drift-alerts",
          name: "Drift alerts + diff viewer",
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
        {
          id: "containers",
          name: "Containers management (sandbox pods)",
          web: WEB_DONE,
          desktop: BACKEND,
        },
      ],
    },
    {
      id: "admin",
      name: "Admin & Company Settings",
      features: [
        {
          id: "members",
          name: "Members management",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "admin-roles",
          name: "Roles & permissions (dynamic RBAC)",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "admin-tags",
          name: "Tags management (tag-based isolation)",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "admin-view-presets",
          name: "View presets (role-scoped landing pages)",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "admin-connectors",
          name: "Connectors (OAuth + API key hub for hooks/agents)",
          web: {
            status: "partial",
            since: "0.1.x",
            notes:
              "Sprint 2 T6 — admin page (list + add tab + 10 templates + 2-step wizard). 2026-05-03: ajout d'une carte « Connecteur custom » + wizard 3 étapes (basics / endpoints / credentials) qui expose le mode sans templateSlug pour brancher n'importe quelle API OAuth 2.0 ou Bearer/API-key. Pas encore de page détail Sheet ni d'audit log table — à finaliser.",
          },
          desktop: BACKEND,
        },
        {
          id: "settings-accounts",
          name: "My connected accounts (user self-service)",
          web: {
            status: "partial",
            since: "0.1.x",
            notes:
              "Sprint 2 T7 — page /settings/accounts. OAuth via popup. Set API key via Dialog. 2026-05-03 : ajout de la nav (sidebar admin + UserMenu), focus param `?focus=<slug>` qui scroll/ring la card matching, redirect via ConnectorRequiredDialog en mode strict (MNM_REQUIRE_USER_CONNECTOR). UserProfile.tsx purgé des providers GitLab/Microsoft hardcodés. Manque toujours le SSE event user.connector_status_changed pour invalidation auto (T8).",
          },
          desktop: BACKEND,
        },
        {
          id: "company-settings",
          name: "Company settings",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "org-chart",
          name: "Org chart",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "audit-log",
          name: "Audit log",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "feedback-dashboard",
          name: "Feedback dashboard",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "automation-cursors",
          name: "Automation cursors (workflow enforcement)",
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
      ],
    },
    {
      id: "infra-sandbox",
      name: "Sandbox & Infrastructure",
      features: [
        {
          id: "claude-token-setup",
          name: "Claude OAuth token setup UI (Settings → Claude)",
          description:
            "Token stored in backend DB (user_pods.claude_oauth_token) and injected via env var on each run by the heartbeat. `copyClaudeCredentials` is removed — DB-stored setup-token is the only approach. Desktop-side smart pickup is tracked separately in `desktop-native → smart-claude-token-pickup`.",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "user-sandbox-docker",
          name: "Per-user Docker sandbox (claude_local adapter)",
          description:
            "Decision (2026-04-11): sandbox stays colocated with whichever machine runs the backend (solo laptop or enterprise server). The desktop app never spawns a sandbox — enterprise deployments host N containers for N users on the backend server. A hypothetical reverse-tunnel sandbox-on-desktop runner is explicitly out of scope.",
          web: WEB_DONE,
          desktop: BACKEND,
        },
        {
          id: "live-events-ws",
          name: "Live events (SSE/WebSocket via /events/ws)",
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
      ],
    },
    {
      id: "connection-profiles",
      name: "Connection Profiles (desktop-only, Chantier 1)",
      features: [
        {
          id: "profile-storage",
          name: "Connection profile CRUD (add / edit / remove / list)",
          description:
            "Stored in app data dir (~/Library/Application Support/com.mnm.desktop/profiles.json) via atomic writes. Rust owns 6 Tauri commands (profile_list/get_active/add/update/remove/set_active) with UUID generation + URL validation + corrupt-file backup recovery. TS layer: initActiveProfile() at boot, cached active profile, apiBase() reads from it in packaged builds, NoProfileGate pre-mount UI for first-launch.",
          web: WEB_NA,
          desktop: { status: "done", since: "0.1.2" },
        },
        {
          id: "profile-keychain-secrets",
          name: "Session token in macOS Keychain per profile",
          description:
            "Uses tauri-plugin-keyring + keyring crate (apple-native). Rust: secrets.rs with secret_set/get/delete commands, cascade delete on profile_remove. TS: secrets-client.ts with in-memory token cache, initSessionToken() at boot. Auth flow: signIn/signUp extract session.token → keychain, signOut clears. API client injects Authorization: Bearer header from cache. All URLs resolved via apiBase() for cross-origin packaged builds.",
          web: WEB_NA,
          desktop: { status: "done", since: "0.1.2" },
        },
        {
          id: "profile-dynamic-csp",
          name: "Strict CSP resolved from the active profile",
          description:
            "Replace the current `null` CSP with a strict one whose connect-src is derived from the active profile's apiBaseUrl. Regenerate on profile switch.",
          web: WEB_NA,
          desktop: DESKTOP_MISSING,
          todo: {
            code: [
              "Rust helper: build_csp(profile) → CSP header string",
              "Apply via tauri runtime CSP or per-window config on profile switch",
            ],
          },
        },
        {
          id: "profile-health-check",
          name: "Backend health check + clear error UI",
          description:
            "Gate 2 in main.tsx boot sequence: after profile loads, checkBackendHealth() pings apiBaseUrl/api/health with 8s timeout + JSON content-type validation (catches Tauri SPA fallback). BackendUnreachable.tsx: full-screen dark-stone error with reason-specific icons (Clock/WifiOff/ServerCrash), profile info card, collapsible error details, Retry (with loading state) / Switch Profile / Setup Backend buttons. Single React root pattern enables re-render on retry without leaking roots.",
          web: WEB_NA,
          desktop: { status: "done", since: "0.1.2" },
        },
        {
          id: "profile-switcher-ui",
          name: "Title bar profile switcher (Slack-style)",
          description:
            "Compact switcher in the title bar showing the active profile + dropdown to switch. Company logo / color per profile for instant recognition.",
          web: WEB_NA,
          desktop: DESKTOP_MISSING,
        },
        {
          id: "first-run-wizard",
          name: "First-run wizard: Local vs Remote instance",
          description:
            "Welcome screen on first launch. Explains the two modes and gates users without a backend toward the private repo (via `backend-setup-link`).",
          web: WEB_NA,
          desktop: DESKTOP_MISSING,
        },
        {
          id: "backend-setup-link",
          name: "Backend setup link (gated by private repo access)",
          description:
            "A UI action that guides users without a backend to request access to the private repo + follow the README setup. This is the product funnel for enterprise adoption.",
          web: WEB_NA,
          desktop: DESKTOP_MISSING,
          todo: {
            notes: [
              "Confirm final URL / contact form with the go-to-market side before wiring it up",
            ],
          },
        },
        {
          id: "api-version-compat",
          name: "API version compatibility check",
          description:
            "Desktop sends `X-MnM-Client-Version` on every request. Backend responds with a compatibility header; desktop surfaces a non-blocking warning banner when the client is below the minimum supported version.",
          web: WEB_NA,
          desktop: DESKTOP_MISSING,
          todo: {
            code: [
              "UI: interceptor to inject version header on every fetch/WS connection",
              "Backend: min-supported-client header on /health (or similar)",
              "UI: banner with 'update desktop app' CTA pointing to the releases page",
            ],
          },
        },
      ],
    },
    {
      id: "desktop-native",
      name: "Desktop-Native Features (no web equivalent)",
      features: [
        {
          id: "dmg-unsigned-build",
          name: "Unsigned DMG build (macOS)",
          web: WEB_NA,
          desktop: { status: "done", since: "0.1.0" },
        },
        {
          id: "tauri-ipc-bindings",
          name: "Type-safe IPC bindings (tauri-specta)",
          web: WEB_NA,
          desktop: { status: "done", since: "0.1.0" },
        },
        {
          id: "smart-claude-token-pickup",
          name: "Smart Claude Code token pickup from local machine",
          description:
            "On first connection to an instance, if Tauri detects a valid local Claude Code OAuth token (e.g. in ~/.claude/ or equivalent), offer to push it to the backend's user_pods.claude_oauth_token in one click. Zero-friction onboarding for users who already ran `claude setup-token`. Falls back to the manual paste flow if no local token is found. Never touches the backend's 'no credentials on sandbox FS' invariant — token still goes through the DB → env var injection path.",
          web: WEB_NA,
          desktop: DESKTOP_MISSING,
          todo: {
            config: [
              "Scope Tauri fs capability to read ~/.claude/* (read-only, explicit path whitelist)",
            ],
            code: [
              "Rust command: detect_local_claude_token() → Option<String>",
              "UI: Settings → Claude card 'Found a local token — use it for this instance?'",
              "Rotation: watcher / manual re-import when the local token changes",
            ],
            notes: [
              "Document clearly in the UI: token is posted to the connected instance's DB (encrypted), not kept solely in Keychain",
            ],
          },
        },
        {
          id: "dmg-codesign",
          name: "Code signing + notarization (Apple Developer ID)",
          web: WEB_NA,
          desktop: {
            status: "missing",
            blockers: ["desktop-codesign-notarization"],
          },
          todo: {
            config: [
              "Apple Developer ID certificate in GitHub Actions secrets",
              "tauri-action workflow for signed + notarized builds",
            ],
          },
        },
        {
          id: "auto-updater",
          name: "Signed auto-updater",
          web: WEB_NA,
          desktop: DESKTOP_MISSING,
          todo: {
            config: ["Configure Tauri updater with signed releases endpoint"],
          },
        },
        {
          id: "strict-csp",
          name: "Strict Content Security Policy (nonce-based)",
          web: WEB_NA,
          desktop: {
            status: "missing",
            notes: "Currently CSP is null for POC iteration.",
          },
          todo: {
            config: ["Move to strict CSP with nonce for inline scripts"],
          },
        },
        {
          id: "keychain-tokens",
          name: "Keychain-stored OAuth tokens (tauri-plugin-keyring)",
          web: WEB_NA,
          desktop: DESKTOP_MISSING,
        },
        {
          id: "native-menus-traffic-lights",
          name: "Native macOS menus + traffic-light styling",
          web: WEB_NA,
          desktop: DESKTOP_MISSING,
        },
        {
          id: "liquid-glass-sidebar",
          name: "Liquid Glass sidebar (NSVisualEffectView)",
          web: WEB_NA,
          desktop: DESKTOP_MISSING,
        },
        {
          id: "tray-icon-status",
          name: "Tray icon with live agent-status indicators",
          web: WEB_NA,
          desktop: DESKTOP_MISSING,
        },
        {
          id: "native-notifications",
          name: "Native macOS notifications (issues, approvals, drift)",
          web: WEB_NA,
          desktop: DESKTOP_MISSING,
        },
        {
          id: "global-hotkey",
          name: "Global hotkey ⌘⇧M (quick agent prompt)",
          web: WEB_NA,
          desktop: DESKTOP_MISSING,
        },
        {
          id: "drag-drop-files",
          name: "Drag & drop files from Finder into chat",
          web: { status: "partial", notes: "Browser DnD works, no FS access" },
          desktop: DESKTOP_MISSING,
        },
        {
          id: "sbom-supply-chain",
          name: "SBOM generation + cargo/bun audit in CI",
          web: WEB_NA,
          desktop: DESKTOP_MISSING,
        },
        {
          id: "hardened-runtime",
          name: "Hardened Runtime entitlements (macOS)",
          web: WEB_NA,
          desktop: DESKTOP_MISSING,
        },
      ],
    },
    {
      id: "governed-workflows",
      name: "Governed Workflows",
      features: [
        {
          id: "governed-workflows-list",
          name: "Workflows list (enable/disable, archive, CTA)",
          description:
            "Table of all non-archived workflow definitions for the company. Toggle enabled state, archive with confirm dialog, link to runs.",
          web: { status: "done", since: "2026-04-24" },
          desktop: {
            status: "missing",
            notes: "Needs connection-profiles + backend access from packaged DMG.",
            blockers: ["desktop-connection-profiles"],
          },
        },
        {
          id: "governed-workflows-editor",
          name: "Workflow definition editor (Monaco + JSON schema autocomplete + zod live validation)",
          description:
            "Create or edit a workflow JSON definition with Monaco in JSON mode. JSON Schema derived from zod workflowDefinitionSchema provides inline squiggles, autocomplete, and French hover tooltips via beforeMount. Side panel shows zod errors. Snippet toolbar: insert step, insert gate, format.",
          web: { status: "done", since: "2026-04-24" },
          desktop: {
            status: "missing",
            notes: "Monaco canvas requires Tauri webview — no known blocker beyond connection-profiles.",
            blockers: ["desktop-connection-profiles"],
          },
        },
        {
          id: "governed-workflows-runs-list",
          name: "Workflow runs list (filters, launch dialog)",
          description:
            "Paginated run history with status/date/actor filters. Launch-run dialog with variable params form and HEAD/latest toggle.",
          web: { status: "done", since: "2026-04-24" },
          desktop: {
            status: "missing",
            blockers: ["desktop-connection-profiles"],
          },
        },
        {
          id: "governed-workflows-run-detail",
          name: "Run detail with live SSE step timeline and gate results",
          description:
            "Step-by-step timeline using useGovernedRunEvents (SSE via LiveUpdatesProvider). Tabs per step: Input / Output / Gates table.",
          web: { status: "done", since: "2026-04-24" },
          desktop: {
            status: "missing",
            notes: "Depends on SSE connectivity inside packaged DMG in addition to connection-profiles.",
            blockers: ["desktop-connection-profiles", "desktop-sse-connectivity"],
          },
        },
        {
          id: "governed-workflows-studio-editor",
          name: "Workflow Studio — multi-file editor with FileTree + Monaco multi-model",
          description:
            "Two-pane resizable editor (FileTree + Monaco) that lazy-loads each workflow file via useWorkflowFiles, tracks dirty buffers per path, and commits all changes atomically via batchCommitFiles. Add/delete/discard dialogs with French UX. Replaces the legacy single-file editor on /workflows/:name — create mode still uses the simpler editor.",
          web: { status: "done", since: "2026-04-24" },
          desktop: {
            status: "missing",
            notes:
              "Desktop doesn't yet lazy-load Monaco multi-model — needs wrapper. Also blocked on connection-profiles for packaged DMG backend access.",
            blockers: ["desktop-connection-profiles"],
          },
          todo: {
            code: [
              "Desktop doesn't yet lazy-load Monaco multi-model — needs wrapper",
            ],
          },
        },
        {
          id: "governed-workflows-ai-assistant",
          name: "Workflow Studio — AI assistant (SSE chat + file proposals)",
          description:
            "Full SSE chat pipeline — the backend endpoint POST /governed-workflows/:name/ai/chat proxies Claude Sonnet with a French system prompt embedding the current workflow.json, the JSON schema, the canonical gate list, and the local gates/*.ts files (typed events: token, file-proposal, error, done; concurrency-limited to 3 in-flight per user). The web UI wires a useAiAssistant hook on top of fetch+getReader() SSE parsing and renders AiAssistantPanel — Chat bubbles with streaming cursor, inline file-proposal cards with Appliquer/Rejeter buttons that call into useWorkflowFiles.",
          web: {
            status: "done",
            since: "2026-04-24",
            notes:
              "SSE stream + file-proposal UX in the Workflow Studio (3rd column). Session-only history — no persistence.",
          },
          desktop: {
            status: "missing",
            notes:
              "Needs the desktop wrapper to route the SSE stream through the packaged backend connection profile.",
            blockers: ["desktop-connection-profiles"],
          },
          todo: {
            code: [
              "Desktop: route SSE through connection profile once web ships",
            ],
          },
        },
        {
          id: "governed-workflows-liveness-watchdog",
          name: "Run liveness + auto-recovery watchdog (Phase 4)",
          description:
            "Resumable continuations + last-useful-action heartbeat for governed runs. Migration 0077 adds resumable_token, last_useful_action_at, next_action_hint, recovery_attempts, last_recovered_at, recovery_policy_json on governed_workflow_runs. detectStalledRuns + recoverRun service in server/src/services/governed-workflows-liveness.ts; in-process watchdog tick wired in server/src/index.ts. REST: GET /runs/:runId/liveness + POST /runs/:runId/recover. Two new live events governed_run.stalled / governed_run.auto_recovered. Web UI: LiveRunWidget shows the last 5 stall/recover events for the company. Auto-recovery is opt-in via LIVENESS_AUTO_RECOVERY=true env or per-run recovery_policy_json.enabled=true.",
          web: {
            status: "done",
            since: "2026-04-30",
            notes:
              "Service + REST + dashboard widget shipped. Watchdog is single-leader (in-process timer) — multi-instance deploys still need a DB advisory lock (TODO).",
          },
          desktop: {
            status: "n/a",
            notes:
              "Pure server feature — desktop wrapper inherits it through the packaged backend.",
          },
          todo: {
            code: [
              "Multi-instance: add advisory lock around runWatchdogTick",
              "CAO watchdog: post auto-comment on the related issue when a run stalls (deferred from §6.2.5)",
            ],
            tests: [
              "E2E: kill agent mid-step, verify auto-recovery fires (plan §6.3 AC, will need adapter wiring first)",
            ],
          },
        },
        {
          id: "governed-workflows-session-bundle",
          name: "Session-bundle runs (Claude Code .jsonl → heartbeat_run timeline)",
          description:
            "Steps gouvernés exécutés côté MCP client (Claude Code) qui déclarent la gate canonique session-file-bundled.gate.ts dans leurs exit gates créent automatiquement un heartbeat_run mode=client à launch_governed_step. À complete_governed_step, le harness bundle son .jsonl dans artifact.data.session_file ; le serveur valide via la gate, parse via parser claude-code-jsonl-v1, matérialise trace + observations + rollup tokens, et lie au step via heartbeat_run_id. UI : badge SessionBundleBadge sur la step card du GovernedWorkflowRunDetail, cliquable → navigue vers la trace reconstruite. Path template paramétrable côté serveur via env vars MNM_SESSION_CAPTURE_*. Idempotence par sha256(bundle).",
          web: {
            status: "done",
            since: "2026-04-30",
            notes:
              "Migration 0078, gate canonique, parser, finalize orchestrator, branchement launchStep/completeStep, badge UI cliquable, parity tracker. V1 = Claude Code only, opt-in par workflow.",
          },
          desktop: {
            status: "n/a",
            notes:
              "Pure server feature — le wrapper desktop hérite via le backend packagé.",
          },
        },
        {
          id: "workflow-hooks",
          name: "Workflow Hooks (T2 + P4 hardening shipped)",
          description:
            "Hooks système full-stack : runner V8 sandboxed (packages/workflow-hooks), 4 canonical hooks (Jira create/comment, ClickUp create/import), resolver canonical/shared/local, service backend (server/src/services/workflow-hooks.ts) avec CRUD + executeHook + resolveHooksForStep, wire 4 phases (before/after launchWorkflow + before/after launchStep + before/after completeStep) dans governed-workflows.ts, REST routes + 6 MCP tools, UI page /hooks (Tabs configs/catalog + Sheet detail + inline toggles + VisibilityPicker), migration 0081 + 5 schemas Drizzle (RLS double-policy fail-closed + perms seeded). Hardening P4 livré : sandbox headers/timeout/body cap/retry, REST principalId + assertBoard, UI optimistic toggles + formatApiError, catalog metadata (description/phase/configSchema/defaultConfig).",
          web: {
            status: "done",
            since: "2026-05-02",
            notes:
              "T2 (T2.1 → T2.9) + P4 (A → G) shippé. SSE event hook.config.updated invalide les query keys (no polling). Backend wire fire-and-forget pour after_run (P4-B). Tests : runner 35, host-helpers, resolver, canonical-hooks, service backend 684 LOC, REST routes 273 LOC, wire test 380 LOC. TODO mineur : Monaco lazy editor pour default_config_json (currently Textarea).",
          },
          desktop: {
            status: "missing",
            notes:
              "Desktop wrapper inherits backend via connection profile. Aucun blocage spécifique côté desktop — sera dispo dès que la chaîne backend packagée est prête.",
          },
          todo: {
            code: [
              "Monaco lazy editor pour default_config_json (currently Textarea)",
              "V1 — HookProviderCatalog migré vers oauth_connectors.base_url (P3 finding)",
              "V1 — durcissement SSRF DNS rebind (rebind-protected fetch)",
            ],
            tests: [
              "E2E browser ChromeMCP : créer config canonical:foo, basculer visibility, toggle enforced (perm hooks:enforce), supprimer",
            ],
          },
        },
        {
          id: "artifact-viewer",
          name: "Artifact viewer (T4 — human review of governed run outputs)",
          description:
            "Three-component stack for reviewing run artifacts: OutputRow (extracted shared row, supports onClick / selected / Copy permalink), RunArtifactsTree (recursive tree across step → outputs, lazy-loads composite sub-runs once T5 ships, gracefully degrades to a flat list pre-T5), ArtifactViewer (mime-aware wrapper that dispatches markdown via MarkdownBody, code via lazy Monaco read-only, plain text via <pre>, external_url via card, git_folder via file list). The run detail page switches to a 2-column review layout when the URL carries `?step=<name>` (set by Inbox `pending_workflow_step` cards). Permalinks: stable URL `/workflows/<name>/runs/<runId>/artifacts/<step>/<output>` with full URI encoding (step may contain `/`). Zero polling — the page reuses the existing `useGovernedRunEvents` SSE subscription.",
          web: {
            status: "done",
            since: "2026-05-03",
            notes:
              "T4.1 → T4.3 shipped. 22 unit tests across OutputRow / RunArtifactsTree / ArtifactViewer / review resolver. Monaco lazy-loaded (frontend rule §6). PendingWorkflowStepCard now navigates with `?step=...` so the user lands in review mode directly.",
          },
          desktop: {
            status: "n/a",
            notes:
              "Pure UI feature reused via the desktop wrapper webview; no IPC required.",
          },
          todo: {
            tests: [
              "Playwright browser test: complete a step with a markdown output → click from Inbox → verify 2-col layout + Copy permalink (T6).",
            ],
          },
        },
        {
          id: "composite-workflows",
          name: "Composite workflows (T5 — meta-workflow `uses:`)",
          description:
            "A workflow step can be `type: 'composite'` and reference another workflow via `uses: workflows/<name>@<ref>`. At launchStep, the orchestrator expands the composite step into a brand-new sub-run (governedWorkflowsCompositeService.launchCompositeStep) linking the parent step row via parent_step_execution_id + composite_run_id and propagating root_run_id for fan-out cap (1000 step_executions per chain). Cycle detection runs at launchRun via static DFS; depth guard at 32. completeStep on a composite step copies the sub-run's terminal artifact into the parent's artifactsJson once every sub-step has succeeded. Migration 0083 adds the 3 columns + partial index governed_step_executions_root_run_idx. SSE events step.composite.launched / step.composite.completed invalidate runDetail. New REST endpoint GET /governed-workflows/runs/:runId/steps for sub-run drill-down.",
          web: {
            status: "done",
            since: "2026-05-03",
            notes:
              "T5.1 → T5.3 shipped. RunArtifactsTree now lazy-loads sub-run children via governedWorkflowsApi.getRunStepsById. StepCard shows a 'composite' badge when compositeRunId is set. Run detail page wires loadSubRun in both review (2-col) and overview modes.",
          },
          desktop: {
            status: "n/a",
            notes:
              "Pure server feature + UI changes reused via the desktop wrapper webview; no IPC required.",
          },
          todo: {
            tests: [
              "E2E Playwright (T6): launch a composite workflow with depth=2, verify the parent step shows the badge, expand the tree, verify drill-down fetches the sub-run.",
            ],
            notes:
              "Documentation under docs/governed-workflows/composite.md is queued for T6.",
          },
        },
        {
          id: "workflow-step-assignments",
          name: "Workflow step assignments (T3 — inbox feed + sidebar badge)",
          description:
            "Migration 0082 + governedStepAssignments table snapshot every step.assignment declaration at launchWorkflow / launchStep with an audit `reason` (tag-intersection / role-expansion / explicit / delta-launchStep). Inbox surfaces the pending steps via REST `GET /inbox/pending-workflow-steps` and MCP tool `list_my_pending_work` (snake_case parity). Sidebar badge `pendingWorkflowSteps` rolls into the aggregated `inbox` count. SSE event `step.assignment.created` (visibility actor-only) invalidates both query keys — zero polling.",
          web: {
            status: "done",
            since: "2026-05-03",
            notes:
              "T3.1 → T3.5 shipped. Section visible on Inbox /new and on /all when filter category = 'pending_workflow_steps'. Card click navigates to the run detail page.",
          },
          desktop: {
            status: "n/a",
            notes:
              "Pure server feature for the data + reuse of the existing Inbox web view through the desktop wrapper.",
          },
        },
      ],
    },
  ],
};
