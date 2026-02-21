"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Key,
  Terminal,
  AlertCircle,
} from "lucide-react";
import type { MnMConfig } from "@/lib/core/config";

interface AuthStatus {
  configured: boolean;
  source: "env" | "config" | "none";
  authType: "api_key" | "oauth_token" | null;
  maskedToken: string | null;
  label: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ApiTabProps {
  config: MnMConfig;
  onUpdate: (patch: Record<string, unknown>) => void;
}

type AuthMethod = "api_key" | "setup_token";

export function ApiTab({ config, onUpdate }: ApiTabProps) {
  const { data: authStatus, mutate: mutateAuth } = useSWR<AuthStatus>(
    "/api/settings/auth-status",
    fetcher
  );

  const [method, setMethod] = useState<AuthMethod>("api_key");
  const [token, setToken] = useState("");
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<{
    status: "idle" | "valid" | "invalid";
    error?: string;
  }>({ status: "idle" });

  const fromEnv = authStatus?.source === "env";

  async function validateAndSave() {
    if (!token.trim()) return;
    setValidating(true);
    setResult({ status: "idle" });
    try {
      const res = await fetch("/api/settings/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: token.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setResult({ status: "valid" });
        setToken("");
        mutateAuth();
      } else {
        setResult({ status: "invalid", error: data.error });
      }
    } catch {
      setResult({
        status: "invalid",
        error: "Could not reach the server. Check your connection.",
      });
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status badge */}
          {authStatus && (
            <div className="flex items-center gap-3">
              {authStatus.configured ? (
                <>
                  <Badge
                    variant="outline"
                    className="gap-1 border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {authStatus.label}
                  </Badge>
                  <code className="text-xs text-muted-foreground">
                    {authStatus.maskedToken}
                  </code>
                </>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400"
                >
                  <AlertCircle className="h-3 w-3" />
                  Not configured
                </Badge>
              )}
              {authStatus.source === "env" && (
                <span className="text-xs text-muted-foreground">
                  Set via environment variable
                </span>
              )}
              {authStatus.source === "config" && (
                <span className="text-xs text-muted-foreground">
                  Stored in config
                </span>
              )}
            </div>
          )}

          {/* Method tabs */}
          {!fromEnv && (
            <>
              <div className="flex gap-1 rounded-lg bg-muted p-1">
                <button
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    method === "api_key"
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setMethod("api_key");
                    setResult({ status: "idle" });
                    setToken("");
                  }}
                >
                  <Key className="mr-1.5 inline h-3.5 w-3.5" />
                  API Key
                </button>
                <button
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    method === "setup_token"
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setMethod("setup_token");
                    setResult({ status: "idle" });
                    setToken("");
                  }}
                >
                  <Terminal className="mr-1.5 inline h-3.5 w-3.5" />
                  Setup Token
                </button>
              </div>

              {/* Input area */}
              <div className="space-y-3">
                {method === "setup_token" && (
                  <div className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">
                      How to get a setup token:
                    </p>
                    <ol className="list-decimal list-inside space-y-0.5 text-xs">
                      <li>
                        Open a terminal and run{" "}
                        <code className="rounded bg-muted px-1">
                          claude setup-token
                        </code>
                      </li>
                      <li>Copy the token that starts with <code className="rounded bg-muted px-1">sk-ant-oat...</code></li>
                      <li>Paste it below</li>
                    </ol>
                    <p className="text-xs mt-2">
                      Uses your Claude subscription — no separate API billing.
                    </p>
                  </div>
                )}

                <Input
                  type="password"
                  placeholder={
                    method === "api_key"
                      ? "sk-ant-api03-..."
                      : "sk-ant-oat01-..."
                  }
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="font-mono text-sm"
                  onKeyDown={(e) => e.key === "Enter" && validateAndSave()}
                />

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={validateAndSave}
                    disabled={validating || !token.trim()}
                  >
                    {validating && (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    )}
                    Validate & Save
                  </Button>
                  {result.status === "valid" && (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle2 className="h-4 w-4" /> Saved
                    </span>
                  )}
                  {result.status === "invalid" && (
                    <span className="flex items-center gap-1 text-sm text-destructive">
                      <XCircle className="h-4 w-4" />
                      {result.error ?? "Invalid"}
                    </span>
                  )}
                </div>

                {method === "api_key" && (
                  <p className="text-xs text-muted-foreground">
                    Get your API key from{" "}
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      console.anthropic.com
                    </a>
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-2">
          <Label htmlFor="instructions-path">
            Custom Drift Instructions Path
          </Label>
          <Input
            id="instructions-path"
            placeholder=".mnm/drift-instructions.md"
            value={config.customInstructionsPath ?? ""}
            onChange={(e) =>
              onUpdate({ customInstructionsPath: e.target.value || undefined })
            }
          />
          <p className="text-xs text-muted-foreground">
            Path to a Markdown file with custom drift analysis instructions
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
