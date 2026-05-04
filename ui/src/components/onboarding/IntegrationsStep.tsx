/**
 * Onboarding step 6: Optional integrations.
 *
 * Three independent cards — LLM provider, Git provider for workflow
 * versioning, External connectors. Each card lets the admin either
 * configure now or skip (the colleague can revisit from Settings).
 *
 * Designed for the standalone-mode "give to colleague" UX: defaults are
 * "skip" so the wizard never blocks on missing third-party credentials.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "../../lib/utils";
import {
  Sparkles,
  GitBranch,
  Plug,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { api } from "../../api/client";

type LlmProvider = "anthropic" | "openai";

interface InstanceLlmConfigPublic {
  provider: LlmProvider | null;
  hasKey: boolean;
  keyHint: string | null;
  updatedAt: string | null;
  fromEnv: boolean;
}

type CardState = "idle" | "configuring" | "configured" | "skipped";

interface Props {
  companyId: string;
  onContinue: () => void;
}

export function IntegrationsStep({ companyId, onContinue }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="bg-muted/50 p-2">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-medium">Optional integrations</h3>
          <p className="text-xs text-muted-foreground">
            Wire up the parts you'll actually use. Everything here is optional and can be configured later from Settings.
          </p>
        </div>
      </div>

      <LlmCard />
      <GitCard companyId={companyId} />
      <ConnectorsCard companyId={companyId} />

      <div className="flex justify-end pt-2">
        <Button size="sm" onClick={onContinue}>
          <ArrowRight className="h-3.5 w-3.5 mr-1" />
          Continue
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LLM provider card
// ---------------------------------------------------------------------------

function LlmCard() {
  const [state, setState] = useState<CardState>("idle");
  const [provider, setProvider] = useState<LlmProvider>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<InstanceLlmConfigPublic | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<InstanceLlmConfigPublic>("/instance-config/llm")
      .then((data) => {
        if (!alive) return;
        setConfig(data);
        if (data.hasKey) setState("configured");
      })
      .catch(() => {
        // non-blocking
      });
    return () => {
      alive = false;
    };
  }, []);

  async function handleSave() {
    if (!apiKey.trim()) {
      setError("Paste an API key first");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await api.put<InstanceLlmConfigPublic>(
        "/instance-config/llm",
        { provider, apiKey: apiKey.trim() },
      );
      setConfig(updated);
      setApiKey("");
      setState("configured");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!confirm("Remove the stored LLM key? AI features will fall back to no-LLM mode.")) return;
    setSaving(true);
    try {
      const updated = await api.delete<InstanceLlmConfigPublic>("/instance-config/llm");
      setConfig(updated);
      setState(updated.hasKey ? "configured" : "idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear key");
    } finally {
      setSaving(false);
    }
  }

  const summary = (() => {
    if (!config) return "Loading…";
    if (config.hasKey && config.fromEnv) {
      return `Using ${config.provider} key from environment (${config.keyHint})`;
    }
    if (config.hasKey) {
      return `${config.provider} key stored (${config.keyHint})`;
    }
    return "Not configured — AI Assistant will be disabled";
  })();

  return (
    <Card
      icon="✨"
      title="LLM provider"
      description="Powers the Workflow Studio AI Assistant, chat replies, and the drift analyzer."
      status={state}
      summary={summary}
    >
      {state === "configured" && config ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-emerald-500" />
            <span className="font-medium">{config.provider}</span>
            <Badge variant="secondary" className="text-[10px]">
              {config.fromEnv ? "from env" : "stored"}
            </Badge>
            <span className="text-xs text-muted-foreground">{config.keyHint}</span>
          </div>
          {!config.fromEnv && (
            <Button variant="outline" size="sm" onClick={handleClear} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Remove key"}
            </Button>
          )}
        </div>
      ) : state === "configuring" ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as LlmProvider)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="anthropic">Anthropic (Claude) — recommended</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">API key</label>
            <div className="flex gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === "anthropic" ? "sk-ant-…" : "sk-…"}
                className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 font-mono"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="px-2 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              Stored encrypted on the server. Never exposed to the browser after save.
            </p>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving || !apiKey.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setState("idle")} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setState("configuring")}>
            Add API key
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setState("skipped")}>
            Skip
          </Button>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Git provider card
// ---------------------------------------------------------------------------

function GitCard({ companyId }: { companyId: string }) {
  const [state, setState] = useState<CardState>("idle");
  const [provider, setProvider] = useState<"gitlab" | "github">("gitlab");
  const [baseUrl, setBaseUrl] = useState("https://gitlab.com");
  const [token, setToken] = useState("");
  const [namespace, setNamespace] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!token.trim()) {
      setError("A personal access token is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // The existing per-company git-provider endpoint accepts this shape.
      // If the route shape differs the user can re-enter from Settings.
      await api.put(`/companies/${companyId}/git-provider-config`, {
        provider,
        baseUrl: baseUrl.trim(),
        token: token.trim(),
        namespace: namespace.trim() || undefined,
      });
      setState("configured");
      setToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save git config");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      icon={<GitBranch className="h-4 w-4" />}
      title="Git for workflow versioning"
      description="Where MnM commits workflow definitions and run artifacts. Skip to use the in-process git store."
      status={state}
      summary={
        state === "configured"
          ? `${provider} configured — ${baseUrl}`
          : state === "skipped"
            ? "Skipped — using in-process git store (workflows still work locally)"
            : "Not configured — using in-process git store by default"
      }
    >
      {state === "configuring" ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Provider</label>
            <select
              value={provider}
              onChange={(e) => {
                const p = e.target.value as "gitlab" | "github";
                setProvider(p);
                setBaseUrl(p === "github" ? "https://github.com" : "https://gitlab.com");
              }}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="gitlab">GitLab (self-hosted or .com)</option>
              <option value="github">GitHub</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Base URL</label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
              placeholder="https://gitlab.example.com"
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
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
              placeholder="glpat-… or ghp_…"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Namespace / org (optional)
            </label>
            <input
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              placeholder="my-team"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving || !token.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setState("idle")} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : state === "configured" ? (
        <div className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 text-emerald-500" />
          <span className="font-medium">{provider}</span>
          <span className="text-xs text-muted-foreground">{baseUrl}</span>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setState("configuring")}>
            Set up git
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setState("skipped")}>
            Skip — use local git
          </Button>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// External connectors card
// ---------------------------------------------------------------------------

function ConnectorsCard({ companyId }: { companyId: string }) {
  const [state, setState] = useState<CardState>("idle");
  return (
    <Card
      icon={<Plug className="h-4 w-4" />}
      title="External connectors"
      description="Jira, ClickUp, Slack, GitHub, Linear, Notion… anything your workflows need to read/write."
      status={state}
      summary={
        state === "skipped"
          ? "Skipped — link integrations later from /settings/connectors"
          : "Not configured — workflows can run without external connectors"
      }
    >
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            window.open(`/${companyId}/admin/connectors`, "_blank", "noopener");
            setState("configured");
          }}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1" />
          Open connector admin
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setState("skipped")}>
          Skip
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card shell
// ---------------------------------------------------------------------------

function Card({
  icon,
  title,
  description,
  status,
  summary,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: CardState;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border p-4 transition-colors",
        status === "configured" && "border-emerald-500/40 bg-emerald-500/5",
        status === "skipped" && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="bg-muted/50 p-1.5 text-base leading-none">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">{summary}</p>
        </div>
        {status === "configured" && (
          <Badge variant="secondary" className="text-[10px] shrink-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
            Configured
          </Badge>
        )}
        {status === "skipped" && (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            Skipped
          </Badge>
        )}
      </div>
      {children}
    </div>
  );
}
