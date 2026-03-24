import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy, Eye, EyeOff, Key, Loader2, Unplug, Terminal } from "lucide-react";
import { sandboxesApi } from "../api/sandboxes";

interface ClaudeTokenSetupProps {
  companyId: string;
  /** Current auth status from user_pods */
  authStatus?: "authenticated" | "unknown" | "expired" | string;
  /** Compact mode for onboarding (no revoke, shorter text) */
  compact?: boolean;
  /** Called after token is saved successfully */
  onSuccess?: () => void;
}

export function ClaudeTokenSetup({
  companyId,
  authStatus,
  compact,
  onSuccess,
}: ClaudeTokenSetupProps) {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const isConnected = authStatus === "authenticated";
  const command = "claude setup-token";

  async function handleSave() {
    const trimmed = token.trim();
    if (!trimmed || !trimmed.startsWith("sk-ant-oat01-")) {
      setError("Token must start with sk-ant-oat01-");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await sandboxesApi.setClaudeToken(companyId, trimmed);
      setSuccess(true);
      setToken("");
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message ?? "Failed to save token");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    setError(null);
    try {
      await sandboxesApi.clearClaudeToken(companyId);
      setSuccess(false);
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message ?? "Failed to revoke token");
    } finally {
      setRevoking(false);
    }
  }

  function handleCopyCommand() {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (success || (isConnected && !token)) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <Check className="w-5 h-5 text-emerald-500 shrink-0" />
          <div>
            <p className="font-medium text-emerald-600 dark:text-emerald-400">Claude Connected</p>
            <p className="text-sm text-muted-foreground">
              Your subscription is active. Agents will use your Claude account.
            </p>
          </div>
        </div>
        {!compact && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSuccess(false); }}
            className="text-xs"
          >
            <Key className="w-3 h-3 mr-1" /> Update Token
          </Button>
        )}
        {!compact && isConnected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRevoke}
            disabled={revoking}
            className="text-xs text-destructive hover:text-destructive ml-2"
          >
            {revoking ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Unplug className="w-3 h-3 mr-1" />}
            Disconnect
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="space-y-3">
        {!compact && (
          <p className="text-sm text-muted-foreground">
            Connect your Claude Pro or Max subscription so your agents can run using your account.
          </p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">
            1. Open a terminal on <span className="text-foreground">your machine</span> and run:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-md bg-muted font-mono text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-muted-foreground shrink-0" />
              {command}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopyCommand} className="shrink-0">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-sm font-medium mt-3">
            2. Follow the browser auth flow, then paste the token below:
          </p>
        </div>
      </div>

      {/* Token input */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={showToken ? "text" : "password"}
            placeholder="sk-ant-oat01-..."
            value={token}
            onChange={(e) => { setToken(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            className="w-full px-3 py-2 pr-10 rounded-md border bg-background font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <Button onClick={handleSave} disabled={saving || !token.trim()} size="sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <p className="text-xs text-muted-foreground">
        Uses your Pro/Max subscription (not API credits). Token valid for 1 year.
      </p>
    </div>
  );
}
