/**
 * Git provider configuration panel.
 *
 * Reused by:
 *   - the onboarding wizard's "Optional integrations" step
 *   - the CompanySettings → Git provider tab
 *
 * Two topologies:
 *
 * 1. Single repo (default) — one git_provider item, optional subtree
 *    prefixes for workflows and agents within the same repo.
 *
 *      provider repo (e.g. gitlab.com/org/mnm-content)
 *        └── workflows/<name>/workflow.json    ← if paths.workflows = "workflows"
 *        └── agents/<id>/agent.md              ← if paths.agents = "agents"
 *
 * 2. Separate repos — two git_provider items keyed by itemName=
 *    "workflows" and itemName="agents". The resolver picks the right
 *    one off the call site's resourceType (server/src/mcp/build-mcp-services.ts:399).
 *
 *      workflows repo (gitlab.com/org/mnm-workflows)  itemName="workflows"
 *      agents repo    (gitlab.com/org/mnm-agents)     itemName="agents"
 *
 * The panel reads existing config via GET /git-provider-config and
 * upserts via PUT /git-provider-config (one PUT per item).
 */

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "../../lib/utils";
import { Check, Loader2, Trash2 } from "lucide-react";
import { api } from "../../api/client";

type Kind = "gitlab";

interface ProviderItemPublic {
  itemId: string;
  itemName: string;
  displayName: string | null;
  enabled: boolean;
  hasToken: boolean;
  config: {
    kind?: Kind | "local";
    providerId?: string;
    baseUrl?: string;
    projectId?: string;
    paths?: { workflows?: string; agents?: string };
    repoDir?: string;
  };
}

interface FormState {
  itemName: string;
  kind: Kind;
  baseUrl: string;
  projectId: string;
  token: string;
  pathsWorkflows: string;
  pathsAgents: string;
}

interface Props {
  companyId: string;
  /** Compact = used inside the onboarding wizard (no card title). */
  compact?: boolean;
}

const EMPTY_FORM = (itemName: string): FormState => ({
  itemName,
  kind: "gitlab",
  baseUrl: "https://gitlab.com",
  projectId: "",
  token: "",
  pathsWorkflows: "",
  pathsAgents: "",
});

export function GitProviderConfigPanel({ companyId, compact }: Props) {
  const [items, setItems] = useState<ProviderItemPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topology, setTopology] = useState<"single" | "separate">("single");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: ProviderItemPublic[] }>(
        `/companies/${companyId}/governed-workflows/git-provider-config`,
      );
      setItems(res.items);
      // Detect topology from existing config: if both "workflows" and
      // "agents" named items exist, switch to separate mode.
      const names = res.items.map((i) => i.itemName);
      if (names.includes("workflows") && names.includes("agents")) {
        setTopology("separate");
      } else {
        setTopology("single");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load git config");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading git configuration…
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", !compact && "p-4 rounded-md border border-border")}>
      {!compact && (
        <div>
          <p className="text-sm font-medium">Git provider</p>
          <p className="text-xs text-muted-foreground">
            Source of truth for workflow definitions, custom gates, agent definitions, and run artifacts.
          </p>
        </div>
      )}

      <Tabs value={topology} onValueChange={(v) => setTopology(v as "single" | "separate")}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="single">Single repo</TabsTrigger>
          <TabsTrigger value="separate">Separate repos</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="pt-3">
          <SingleRepoForm
            companyId={companyId}
            existing={items.find((i) => i.itemName === "default") ?? null}
            otherNamed={items.filter((i) => i.itemName !== "default")}
            onSaved={reload}
          />
        </TabsContent>

        <TabsContent value="separate" className="pt-3 space-y-4">
          <SeparateRepoForm
            companyId={companyId}
            label="Workflows repo"
            description="Stores workflow.json + custom gates."
            itemName="workflows"
            pathKey="workflows"
            existing={items.find((i) => i.itemName === "workflows") ?? null}
            onSaved={reload}
          />
          <SeparateRepoForm
            companyId={companyId}
            label="Agents repo"
            description="Stores agent definitions (agent.md + frontmatter)."
            itemName="agents"
            pathKey="agents"
            existing={items.find((i) => i.itemName === "agents") ?? null}
            onSaved={reload}
          />
          <p className="text-[11px] text-muted-foreground/70">
            Run artifacts always go alongside the workflow they belong to (committed on the workflows repo's <code className="font-mono bg-muted px-1 rounded">mnm-runs/&lt;run_id&gt;</code> branches, then merged).
          </p>
        </TabsContent>
      </Tabs>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single repo form (one item named "default", optional path prefixes)
// ---------------------------------------------------------------------------

function SingleRepoForm({
  companyId,
  existing,
  otherNamed,
  onSaved,
}: {
  companyId: string;
  existing: ProviderItemPublic | null;
  otherNamed: ProviderItemPublic[];
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(() => initFromItem(existing, "default"));
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(existing?.config.paths?.workflows || existing?.config.paths?.agents),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  async function handleSave() {
    if (!form.token.trim() && !existing?.hasToken) {
      setError("A personal access token is required");
      return;
    }
    setSaving(true);
    setError(null);
    setSavedNotice(null);
    try {
      const body: Record<string, unknown> = {
        kind: "gitlab",
        providerId: "gitlab:primary",
        baseUrl: form.baseUrl.trim(),
        projectId: form.projectId.trim(),
        itemName: "default",
      };
      if (form.token.trim()) body.token = form.token.trim();
      const paths: Record<string, string> = {};
      if (form.pathsWorkflows.trim()) paths.workflows = form.pathsWorkflows.trim();
      if (form.pathsAgents.trim()) paths.agents = form.pathsAgents.trim();
      if (Object.keys(paths).length > 0) body.paths = paths;

      await api.put(
        `/companies/${companyId}/governed-workflows/git-provider-config`,
        body,
      );
      setForm((f) => ({ ...f, token: "" }));
      setSavedNotice("Saved — restart the server for the change to take effect.");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {existing && (
        <div className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 text-emerald-500" />
          <span className="font-medium">{existing.config.kind ?? "gitlab"}</span>
          <span className="text-xs text-muted-foreground">{existing.config.baseUrl}</span>
          <Badge variant="secondary" className="text-[10px]">Configured</Badge>
        </div>
      )}

      {otherNamed.length > 0 && (
        <p className="text-[11px] text-muted-foreground/70">
          Note: this company also has {otherNamed.length} named item(s) ({otherNamed.map((i) => i.itemName).join(", ")}). Saving below will not remove them.
        </p>
      )}

      <FormFields form={form} setForm={setForm} hasExistingToken={Boolean(existing?.hasToken)} />

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? "▾ Hide advanced (subtree paths)" : "▸ Advanced — subtree paths"}
        </button>
        {showAdvanced && (
          <div className="mt-2 space-y-2 rounded-md border border-border/60 p-3">
            <p className="text-[11px] text-muted-foreground/80">
              Optional subtree prefixes inside the repo. Leave empty to keep files at the repo root.
            </p>
            <PathField
              label="Workflows path prefix"
              placeholder="e.g. workflows"
              value={form.pathsWorkflows}
              onChange={(v) => setForm((f) => ({ ...f, pathsWorkflows: v }))}
              example={form.pathsWorkflows ? `${form.pathsWorkflows}/<name>/workflow.json` : "<name>/workflow.json"}
            />
            <PathField
              label="Agents path prefix"
              placeholder="e.g. agents"
              value={form.pathsAgents}
              onChange={(v) => setForm((f) => ({ ...f, pathsAgents: v }))}
              example={form.pathsAgents ? `${form.pathsAgents}/<id>/agent.md` : "<id>/agent.md"}
            />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {savedNotice && <p className="text-xs text-emerald-600 dark:text-emerald-400">{savedNotice}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
          {existing ? "Update" : "Save"}
        </Button>
        {existing && (
          <DeleteButton companyId={companyId} itemName="default" onDeleted={onSaved} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Separate-repo form (one form per resource type)
// ---------------------------------------------------------------------------

function SeparateRepoForm({
  companyId,
  label,
  description,
  itemName,
  pathKey,
  existing,
  onSaved,
}: {
  companyId: string;
  label: string;
  description: string;
  itemName: "workflows" | "agents";
  pathKey: "workflows" | "agents";
  existing: ProviderItemPublic | null;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(() => {
    const base = initFromItem(existing, itemName);
    // For separate-repo mode the panel auto-fills the relevant path prefix
    // with the resource type name unless the user wrote something else.
    if (pathKey === "workflows" && !base.pathsWorkflows) base.pathsWorkflows = existing?.config.paths?.workflows ?? "";
    if (pathKey === "agents" && !base.pathsAgents) base.pathsAgents = existing?.config.paths?.agents ?? "";
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  async function handleSave() {
    if (!form.token.trim() && !existing?.hasToken) {
      setError("A personal access token is required");
      return;
    }
    setSaving(true);
    setError(null);
    setSavedNotice(null);
    try {
      const body: Record<string, unknown> = {
        kind: "gitlab",
        providerId: `gitlab:${itemName}`,
        baseUrl: form.baseUrl.trim(),
        projectId: form.projectId.trim(),
        itemName,
      };
      if (form.token.trim()) body.token = form.token.trim();
      // Set the resource-type path so the resolver picks this item for the
      // matching resourceType. An empty string means "files at repo root"
      // — still valid; the resolver only checks the field is *defined*.
      body.paths = { [pathKey]: pathKey === "workflows" ? form.pathsWorkflows : form.pathsAgents };

      await api.put(
        `/companies/${companyId}/governed-workflows/git-provider-config`,
        body,
      );
      setForm((f) => ({ ...f, token: "" }));
      setSavedNotice("Saved — restart the server for the change to take effect.");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-[11px] text-muted-foreground/80">{description}</p>
        </div>
        {existing && (
          <Badge variant="secondary" className="text-[10px] shrink-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
            Configured
          </Badge>
        )}
      </div>

      <FormFields form={form} setForm={setForm} hasExistingToken={Boolean(existing?.hasToken)} />
      <PathField
        label="Path prefix in this repo"
        placeholder={`e.g. ${pathKey === "workflows" ? "src/workflows" : "src/agents"}`}
        value={pathKey === "workflows" ? form.pathsWorkflows : form.pathsAgents}
        onChange={(v) =>
          pathKey === "workflows"
            ? setForm((f) => ({ ...f, pathsWorkflows: v }))
            : setForm((f) => ({ ...f, pathsAgents: v }))
        }
        example={
          pathKey === "workflows"
            ? `${form.pathsWorkflows ? form.pathsWorkflows + "/" : ""}<name>/workflow.json`
            : `${form.pathsAgents ? form.pathsAgents + "/" : ""}<id>/agent.md`
        }
      />

      {error && <p className="text-xs text-destructive">{error}</p>}
      {savedNotice && <p className="text-xs text-emerald-600 dark:text-emerald-400">{savedNotice}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
          {existing ? "Update" : "Save"}
        </Button>
        {existing && (
          <DeleteButton companyId={companyId} itemName={itemName} onDeleted={onSaved} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared form fields
// ---------------------------------------------------------------------------

function FormFields({
  form,
  setForm,
  hasExistingToken,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  hasExistingToken: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground/70">
        GitLab only for now (self-hosted or .com). GitHub support is on the roadmap via the Connectors Platform.
      </p>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Base URL</label>
        <input
          value={form.baseUrl}
          onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
          placeholder="https://gitlab.example.com"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Project ID / repo path</label>
        <input
          value={form.projectId}
          onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
          placeholder="12345 or org/repo"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Personal access token{" "}
          <span className="text-muted-foreground/60">
            (scopes: api, read_repository, write_repository)
          </span>
        </label>
        <input
          type="password"
          value={form.token}
          onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
          placeholder={hasExistingToken ? "•••••••• (leave empty to keep current)" : "glpat-… or ghp_…"}
        />
      </div>
    </div>
  );
}

function PathField({
  label,
  placeholder,
  value,
  onChange,
  example,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  example: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
        placeholder={placeholder}
      />
      <p className="text-[11px] text-muted-foreground/60 mt-1 font-mono">→ {example}</p>
    </div>
  );
}

function DeleteButton({
  companyId,
  itemName,
  onDeleted,
}: {
  companyId: string;
  itemName: string;
  onDeleted: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Remove the "${itemName}" git provider configuration?`)) return;
        setBusy(true);
        try {
          await api.delete(
            `/companies/${companyId}/governed-workflows/git-provider-config/${encodeURIComponent(itemName)}`,
          );
          await onDeleted();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </Button>
  );
}

function initFromItem(
  item: ProviderItemPublic | null,
  itemName: string,
): FormState {
  if (!item) return EMPTY_FORM(itemName);
  const cfg = item.config;
  return {
    itemName: item.itemName,
    kind: "gitlab",
    baseUrl: cfg.baseUrl ?? "https://gitlab.com",
    projectId: cfg.projectId ?? "",
    token: "",
    pathsWorkflows: cfg.paths?.workflows ?? "",
    pathsAgents: cfg.paths?.agents ?? "",
  };
}
