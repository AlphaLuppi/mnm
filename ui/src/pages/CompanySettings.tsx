import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { companiesApi } from "../api/companies";
import { accessApi } from "../api/access";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings, Check, Sun, Moon, Monitor, Key } from "lucide-react";
import { ClaudeTokenSetup } from "../components/ClaudeTokenSetup";
import { sandboxesApi } from "../api/sandboxes";
import { useQuery } from "@tanstack/react-query";
import { CompanyPatternIcon } from "../components/CompanyPatternIcon";
import {
  Field,
  ToggleField,
  HintIcon,
} from "../components/agent-config-primitives";

type AgentSnippetInput = {
  onboardingTextUrl: string;
  connectionCandidates?: string[] | null;
  testResolutionUrl?: string | null;
};

/* ---- Preferences stored in localStorage ---- */
type Preferences = {
  theme: "light" | "dark" | "system";
  fontSize: number;
  driftDetectionEnabled: boolean;
  defaultAgentType: string;
  maxConcurrentAgents: number;
  agentTimeoutSec: number;
  telemetryOptIn: boolean;
};

const PREFS_KEY = "mnm:preferences";

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...defaultPrefs, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...defaultPrefs };
}

const defaultPrefs: Preferences = {
  theme: "system",
  fontSize: 14,
  driftDetectionEnabled: true,
  defaultAgentType: "implementation",
  maxConcurrentAgents: 3,
  agentTimeoutSec: 300,
  telemetryOptIn: false,
};

function savePreferences(prefs: Preferences) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function applyTheme(theme: Preferences["theme"]) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    // system
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  }
}

export function CompanySettings() {
  const {
    companies,
    selectedCompany,
    selectedCompanyId,
    setSelectedCompanyId,
  } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  // Sandbox query (for Claude auth status)
  const sandboxQuery = useQuery({
    queryKey: ["sandbox", selectedCompanyId],
    queryFn: () => sandboxesApi.getMySandbox(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // General settings local state
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [brandColor, setBrandColor] = useState("");

  // Preferences (local-only settings)
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);

  function updatePref<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      savePreferences(next);
      if (key === "theme") applyTheme(next.theme);
      if (key === "fontSize") {
        document.documentElement.style.fontSize = `${next.fontSize}px`;
      }
      return next;
    });
  }

  // Sync local state from selected company
  useEffect(() => {
    if (!selectedCompany) return;
    setCompanyName(selectedCompany.name);
    setDescription(selectedCompany.description ?? "");
    setBrandColor(selectedCompany.brandColor ?? "");
  }, [selectedCompany]);

  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSnippet, setInviteSnippet] = useState<string | null>(null);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [snippetCopyDelightId, setSnippetCopyDelightId] = useState(0);

  const generalDirty =
    !!selectedCompany &&
    (companyName !== selectedCompany.name ||
      description !== (selectedCompany.description ?? "") ||
      brandColor !== (selectedCompany.brandColor ?? ""));

  const generalMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description: string | null;
      brandColor: string | null;
    }) => companiesApi.update(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: (requireApproval: boolean) =>
      companiesApi.update(selectedCompanyId!, {
        requireBoardApprovalForNewAgents: requireApproval,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      accessApi.createOpenClawInvitePrompt(selectedCompanyId!),
    onSuccess: async (invite) => {
      setInviteError(null);
      const base = window.location.origin.replace(/\/+$/, "");
      const onboardingTextLink =
        invite.onboardingTextUrl ??
        invite.onboardingTextPath ??
        `/api/invites/${invite.token}/onboarding.txt`;
      const absoluteUrl = onboardingTextLink.startsWith("http")
        ? onboardingTextLink
        : `${base}${onboardingTextLink}`;
      setSnippetCopied(false);
      setSnippetCopyDelightId(0);
      let snippet: string;
      try {
        const manifest = await accessApi.getInviteOnboarding(invite.token);
        snippet = buildAgentSnippet({
          onboardingTextUrl: absoluteUrl,
          connectionCandidates:
            manifest.onboarding.connectivity?.connectionCandidates ?? null,
          testResolutionUrl:
            manifest.onboarding.connectivity?.testResolutionEndpoint?.url ??
            null,
        });
      } catch {
        snippet = buildAgentSnippet({
          onboardingTextUrl: absoluteUrl,
          connectionCandidates: null,
          testResolutionUrl: null,
        });
      }
      setInviteSnippet(snippet);
      try {
        await navigator.clipboard.writeText(snippet);
        setSnippetCopied(true);
        setSnippetCopyDelightId((prev) => prev + 1);
        setTimeout(() => setSnippetCopied(false), 2000);
      } catch {
        /* clipboard may not be available */
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.sidebarBadges(selectedCompanyId!),
      });
    },
    onError: (err) => {
      setInviteError(
        err instanceof Error ? err.message : "Failed to create invite",
      );
    },
  });

  useEffect(() => {
    setInviteError(null);
    setInviteSnippet(null);
    setSnippetCopied(false);
    setSnippetCopyDelightId(0);
  }, [selectedCompanyId]);

  const archiveMutation = useMutation({
    mutationFn: ({
      companyId,
      nextCompanyId,
    }: {
      companyId: string;
      nextCompanyId: string | null;
    }) => companiesApi.archive(companyId).then(() => ({ nextCompanyId })),
    onSuccess: async ({ nextCompanyId }) => {
      if (nextCompanyId) {
        setSelectedCompanyId(nextCompanyId);
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.all,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.stats,
      });
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company", href: "/dashboard" },
      { label: "Settings" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  if (!selectedCompany) {
    return (
      <div className="text-sm text-muted-foreground">
        No company selected. Select a company from the switcher above.
      </div>
    );
  }

  function handleSaveGeneral() {
    generalMutation.mutate({
      name: companyName.trim(),
      description: description.trim() || null,
      brandColor: brandColor || null,
    });
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      <Tabs defaultValue="general">
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="invites">Invites</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="claude">Claude</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* ──── General Tab ──── */}
        <TabsContent value="general" className="space-y-6">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Company
            </div>
            <div className="space-y-3 rounded-md border border-border px-4 py-4">
              <Field label="Company name" hint="The display name for your company.">
                <Input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </Field>
              <Field
                label="Description"
                hint="Optional description shown in the company profile."
              >
                <Input
                  type="text"
                  value={description}
                  placeholder="Optional company description"
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* Appearance */}
          <div className="space-y-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Appearance
            </div>
            <div className="space-y-3 rounded-md border border-border px-4 py-4">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <CompanyPatternIcon
                    companyName={companyName || selectedCompany.name}
                    brandColor={brandColor || null}
                    className="rounded-[14px]"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Field
                    label="Brand color"
                    hint="Sets the hue for the company icon. Leave empty for auto-generated color."
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brandColor || "#6366f1"}
                        onChange={(e) => setBrandColor(e.target.value)}
                        className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
                      />
                      <Input
                        type="text"
                        value={brandColor}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "" || /^#[0-9a-fA-F]{0,6}$/.test(v)) {
                            setBrandColor(v);
                          }
                        }}
                        placeholder="Auto"
                        className="w-28 font-mono"
                      />
                      {brandColor && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setBrandColor("")}
                          className="text-xs text-muted-foreground"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </Field>
                </div>
              </div>
            </div>
          </div>

          {/* Save button for General + Appearance */}
          {generalDirty && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveGeneral}
                disabled={generalMutation.isPending || !companyName.trim()}
              >
                {generalMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
              {generalMutation.isSuccess && (
                <span className="text-xs text-muted-foreground">Saved</span>
              )}
              {generalMutation.isError && (
                <span className="text-xs text-destructive">
                  {generalMutation.error instanceof Error
                    ? generalMutation.error.message
                    : "Failed to save"}
                </span>
              )}
            </div>
          )}

          {/* Hiring */}
          <div className="space-y-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Hiring
            </div>
            <div className="rounded-md border border-border px-4 py-3">
              <ToggleField
                label="Require board approval for new hires"
                hint="New agent hires stay pending until approved by board."
                checked={!!selectedCompany.requireBoardApprovalForNewAgents}
                onChange={(v) => settingsMutation.mutate(v)}
              />
            </div>
          </div>
        </TabsContent>

        {/* ──── Agents Tab ──── */}
        <TabsContent value="agents" className="space-y-6">
          <div className="space-y-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Agent Defaults
            </div>
            <div className="space-y-3 rounded-md border border-border px-4 py-4">
              <Field label="Default agent type" hint="The default agent type when launching new agents.">
                <select
                  className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                  value={prefs.defaultAgentType}
                  onChange={(e) => updatePref("defaultAgentType", e.target.value)}
                >
                  <option value="implementation">Implementation</option>
                  <option value="tdd">TDD</option>
                  <option value="e2e">E2E Testing</option>
                  <option value="review">Code Review</option>
                </select>
              </Field>
              <Field label="Max concurrent agents" hint="Maximum number of agents that can run simultaneously (1-10).">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  className="w-24"
                  value={prefs.maxConcurrentAgents}
                  onChange={(e) =>
                    updatePref(
                      "maxConcurrentAgents",
                      Math.max(1, Math.min(10, parseInt(e.target.value) || 1)),
                    )
                  }
                />
              </Field>
              <Field label="Agent timeout (seconds)" hint="Maximum seconds an agent run can take before being terminated.">
                <Input
                  type="number"
                  min={0}
                  className="w-24"
                  value={prefs.agentTimeoutSec}
                  onChange={(e) =>
                    updatePref("agentTimeoutSec", Math.max(0, parseInt(e.target.value) || 0))
                  }
                />
              </Field>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Drift Detection
            </div>
            <div className="rounded-md border border-border px-4 py-3">
              <ToggleField
                label="Enable drift detection"
                hint="Automatically detect spec-code drift after agent runs."
                checked={prefs.driftDetectionEnabled}
                onChange={(v) => updatePref("driftDetectionEnabled", v)}
              />
            </div>
          </div>
        </TabsContent>

        {/* ──── Invites Tab ──── */}
        <TabsContent value="invites" className="space-y-6">
          <div className="space-y-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Invites
            </div>
            <div className="space-y-3 rounded-md border border-border px-4 py-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  Generate an OpenClaw agent invite snippet.
                </span>
                <HintIcon text="Creates a short-lived OpenClaw agent invite and renders a copy-ready prompt." />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => inviteMutation.mutate()}
                  disabled={inviteMutation.isPending}
                >
                  {inviteMutation.isPending
                    ? "Generating..."
                    : "Generate OpenClaw Invite Prompt"}
                </Button>
              </div>
              {inviteError && (
                <p className="text-sm text-destructive">{inviteError}</p>
              )}
              {inviteSnippet && (
                <div className="rounded-md border border-border bg-muted/30 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      OpenClaw Invite Prompt
                    </div>
                    {snippetCopied && (
                      <span
                        key={snippetCopyDelightId}
                        className="flex items-center gap-1 text-xs text-green-600 animate-pulse"
                      >
                        <Check className="h-3 w-3" />
                        Copied
                      </span>
                    )}
                  </div>
                  <div className="mt-1 space-y-1.5">
                    <textarea
                      className="h-[28rem] w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none"
                      value={inviteSnippet}
                      readOnly
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(inviteSnippet);
                            setSnippetCopied(true);
                            setSnippetCopyDelightId((prev) => prev + 1);
                            setTimeout(() => setSnippetCopied(false), 2000);
                          } catch {
                            /* clipboard may not be available */
                          }
                        }}
                      >
                        {snippetCopied ? "Copied snippet" : "Copy snippet"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ──── Preferences Tab ──── */}
        <TabsContent value="preferences" className="space-y-6">
          <div className="space-y-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Theme
            </div>
            <div className="rounded-md border border-border px-4 py-4">
              <Field label="Color theme" hint="Choose between light, dark, or system preference.">
                <div className="flex gap-2 mt-1">
                  {(
                    [
                      { value: "light", icon: Sun, label: "Light" },
                      { value: "dark", icon: Moon, label: "Dark" },
                      { value: "system", icon: Monitor, label: "System" },
                    ] as const
                  ).map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      onClick={() => updatePref("theme", value)}
                      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                        prefs.theme === value
                          ? "border-foreground/30 bg-accent text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Typography
            </div>
            <div className="rounded-md border border-border px-4 py-4">
              <Field label={`Font size: ${prefs.fontSize}px`} hint="Base font size for the UI (12-20px).">
                <input
                  type="range"
                  min={12}
                  max={20}
                  value={prefs.fontSize}
                  onChange={(e) => updatePref("fontSize", parseInt(e.target.value))}
                  className="w-full mt-1"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>12px</span>
                  <span>20px</span>
                </div>
              </Field>
            </div>
          </div>
        </TabsContent>

        {/* ──── Claude Tab ──── */}
        <TabsContent value="claude" className="space-y-6">
          <div className="space-y-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Claude Connection
            </div>
            <div className="rounded-md border border-border px-4 py-4">
              <ClaudeTokenSetup
                companyId={selectedCompanyId!}
                authStatus={sandboxQuery?.data?.pod?.claudeAuthStatus}
                onSuccess={() => sandboxQuery.refetch()}
              />
            </div>
          </div>
        </TabsContent>

        {/* ──── Advanced Tab ──── */}
        <TabsContent value="advanced" className="space-y-6">
          {/* Privacy */}
          <div className="space-y-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Privacy
            </div>
            <div className="rounded-md border border-border px-4 py-3">
              <ToggleField
                label="Telemetry opt-in"
                hint="Send anonymous usage data to help improve MnM. Disabled by default."
                checked={prefs.telemetryOptIn}
                onChange={(v) => updatePref("telemetryOptIn", v)}
              />
            </div>
          </div>

          {/* Danger Zone */}
          <div className="space-y-4">
            <div className="text-xs font-medium text-destructive uppercase tracking-wide">
              Danger Zone
            </div>
            <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-4">
              <p className="text-sm text-muted-foreground">
                Archive this company to hide it from the sidebar. This persists in
                the database.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={
                    archiveMutation.isPending ||
                    selectedCompany.status === "archived"
                  }
                  onClick={() => {
                    if (!selectedCompanyId) return;
                    const confirmed = window.confirm(
                      `Archive company "${selectedCompany.name}"? It will be hidden from the sidebar.`,
                    );
                    if (!confirmed) return;
                    const nextCompanyId =
                      companies.find(
                        (company) =>
                          company.id !== selectedCompanyId &&
                          company.status !== "archived",
                      )?.id ?? null;
                    archiveMutation.mutate({
                      companyId: selectedCompanyId,
                      nextCompanyId,
                    });
                  }}
                >
                  {archiveMutation.isPending
                    ? "Archiving..."
                    : selectedCompany.status === "archived"
                      ? "Already archived"
                      : "Archive company"}
                </Button>
                {archiveMutation.isError && (
                  <span className="text-xs text-destructive">
                    {archiveMutation.error instanceof Error
                      ? archiveMutation.error.message
                      : "Failed to archive company"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function buildAgentSnippet(input: AgentSnippetInput) {
  const candidateUrls = buildCandidateOnboardingUrls(input);
  const resolutionTestUrl = buildResolutionTestUrl(input);

  const candidateList =
    candidateUrls.length > 0
      ? candidateUrls.map((u) => `- ${u}`).join("\n")
      : "- (No candidate URLs available yet.)";

  const connectivityBlock =
    candidateUrls.length === 0
      ? `No candidate URLs are available. Ask your user to configure a reachable hostname in MnM, then retry.
Suggested steps:
- choose a hostname that resolves to the MnM host from your runtime
- run: pnpm mnm allowed-hostname <host>
- restart MnM
- verify with: curl -fsS http://<host>:3100/api/health
- regenerate this invite snippet`
      : `If none are reachable, ask your user to add a reachable hostname in MnM, restart, and retry.
Suggested command:
- pnpm mnm allowed-hostname <host>
Then verify with: curl -fsS <base-url>/api/health`;

  const resolutionLine = resolutionTestUrl
    ? `\nYou MUST test MnM-to-gateway reachability, call: ${resolutionTestUrl}?url=<urlencoded-gateway-url> (using the hostname that worked above). Do not assume your 172.x is necessarily reachable from MnM. Test it. `
    : "";

  return `You're invited to join a MnM organization.

The URLs you should try are:
${candidateList}

Connectivity guidance:
If you are running on a different machine than MnM, MnM must be reachable at one of the hostnames used above.
Verify the hostname works from your runtime with: GET <base-url>/api/health

${connectivityBlock}

For your "agentName", just use your own agent name (OpenClaw or whatever your name is) and send it directly.
You also need to send a gateway URL that MnM can access. Check your config and include that URL.${resolutionLine}

---

This onboarding flow is for OpenClaw Gateway.
When you submit the join request, use:
- \`adapterType: "openclaw_gateway"\`
- \`agentDefaultsPayload.url\` as your \`ws://\` or \`wss://\` gateway URL
- \`agentDefaultsPayload.headers["x-openclaw-token"]\` with your gateway token
- (legacy accepted) \`agentDefaultsPayload.headers["x-openclaw-auth"]\`
- Keep device auth enabled (recommended). If \`devicePrivateKeyPem\` is omitted, MnM will generate and persist one during join so pairing approvals remain stable.
- Only use \`disableDeviceAuth=true\` for special environments where pairing cannot be completed.

Do NOT use \`/v1/responses\` or \`/hooks/*\` in this join flow.

Before you do anything, please respond to your user that you understand the instructions and you're going to work on them. Then do the step above in another session called "mnm-onboarding" and then tell your user when you're done. Update your user in intermediate steps along the way so they know what's going on.

Then after you've connected to MnM (exchanged keys etc.) you MUST review and follow the onboarding instructions in onboarding.txt they give you.

`;
}

function buildCandidateOnboardingUrls(input: AgentSnippetInput): string[] {
  const candidates = (input.connectionCandidates ?? [])
    .map((candidate) => candidate.trim())
    .filter(Boolean);
  const urls = new Set<string>();
  let onboardingUrl: URL | null = null;

  try {
    onboardingUrl = new URL(input.onboardingTextUrl);
    urls.add(onboardingUrl.toString());
  } catch {
    const trimmed = input.onboardingTextUrl.trim();
    if (trimmed) {
      urls.add(trimmed);
    }
  }

  if (!onboardingUrl) {
    for (const candidate of candidates) {
      urls.add(candidate);
    }
    return Array.from(urls);
  }

  const onboardingPath = `${onboardingUrl.pathname}${onboardingUrl.search}`;
  for (const candidate of candidates) {
    try {
      const base = new URL(candidate);
      urls.add(`${base.origin}${onboardingPath}`);
    } catch {
      urls.add(candidate);
    }
  }

  return Array.from(urls);
}

function buildResolutionTestUrl(input: AgentSnippetInput): string | null {
  const explicit = input.testResolutionUrl?.trim();
  if (explicit) return explicit;

  try {
    const onboardingUrl = new URL(input.onboardingTextUrl);
    const testPath = onboardingUrl.pathname.replace(
      /\/onboarding\.txt$/,
      "/test-resolution",
    );
    return `${onboardingUrl.origin}${testPath}`;
  } catch {
    return null;
  }
}
