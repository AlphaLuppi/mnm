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
 */
const BLOCKERS = {
  "desktop-backend-connectivity":
    "Packaged DMG cannot reach the backend — needs Tauri-side API base URL config + CSP allowance. Fixed in dev via Vite proxy only.",
  "desktop-auth-storage":
    "Desktop needs secure token storage (Keychain via tauri-plugin-keyring) instead of cookies/localStorage.",
  "desktop-sse-connectivity":
    "Live events (SSE/WebSocket) not yet verified in packaged build — relies on backend connectivity fix first.",
  "desktop-packaged-verification":
    "Feature works in `bun run dev:desktop` (Vite proxy) but has never been exercised inside a signed/packaged DMG.",
  "desktop-codesign-notarization":
    "Sprint 2 milestone — no Apple Developer ID signing or notarization yet; Gatekeeper blocks first launch.",
} as const satisfies Record<string, string>;

// Convenient short-hands so features below stay readable
const BACKEND: PlatformState = {
  status: "dev-only",
  since: "0.1.1",
  blockers: ["desktop-backend-connectivity", "desktop-packaged-verification"],
};
const BACKEND_SSE: PlatformState = {
  status: "dev-only",
  since: "0.1.1",
  blockers: [
    "desktop-backend-connectivity",
    "desktop-sse-connectivity",
    "desktop-packaged-verification",
  ],
};
const BACKEND_AUTH: PlatformState = {
  status: "dev-only",
  since: "0.1.1",
  blockers: [
    "desktop-backend-connectivity",
    "desktop-auth-storage",
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
          desktop: BACKEND_AUTH,
          todo: {
            code: [
              "Expose API base URL via Tauri command or build-time env",
              "Store session token in macOS Keychain (tauri-plugin-keyring)",
            ],
            tests: ["E2E: signup → auto-admin inside packaged DMG"],
          },
        },
        {
          id: "signin-signout",
          name: "Sign in / sign out",
          web: WEB_DONE,
          desktop: BACKEND_AUTH,
        },
        {
          id: "onboarding-wizard",
          name: "Onboarding wizard (dual-mode, invite, progress)",
          web: WEB_DONE,
          desktop: BACKEND_AUTH,
        },
        {
          id: "invite-landing",
          name: "Invite landing page (magic link)",
          web: WEB_DONE,
          desktop: BACKEND_AUTH,
        },
        {
          id: "board-claim",
          name: "Board claim flow (public token → join)",
          web: WEB_DONE,
          desktop: BACKEND_AUTH,
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
          web: WEB_DONE,
          desktop: BACKEND_SSE,
        },
        {
          id: "jira-import",
          name: "Jira import",
          web: WEB_DONE,
          desktop: BACKEND,
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
            "Token injected via env var on each run from user_pods.claude_oauth_token.",
          web: WEB_DONE,
          desktop: BACKEND_AUTH,
          todo: {
            code: [
              "Decide: store token in desktop Keychain vs reuse server-side DB path",
            ],
          },
        },
        {
          id: "user-sandbox-docker",
          name: "Per-user Docker sandbox (claude_local adapter)",
          web: WEB_DONE,
          desktop: BACKEND,
          todo: {
            notes: [
              "Desktop may eventually spawn a local sandbox without backend round-trip — design decision pending",
            ],
          },
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
  ],
};
