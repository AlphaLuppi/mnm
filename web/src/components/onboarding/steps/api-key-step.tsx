"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Key, Terminal } from "lucide-react";

interface ApiKeyStepProps {
  onValidated: (valid: boolean) => void;
}

type AuthMethod = "api_key" | "setup_token";

export function ApiKeyStep({ onValidated }: ApiKeyStepProps) {
  const [method, setMethod] = useState<AuthMethod>("api_key");
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSetupToken = method === "setup_token";

  async function validateKey() {
    if (!key.trim()) return;
    setStatus("checking");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/settings/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setStatus("valid");
        onValidated(true);
      } else {
        setStatus("invalid");
        setErrorMsg(data.error ?? "Invalid credentials");
        onValidated(false);
      }
    } catch {
      setStatus("invalid");
      setErrorMsg("Could not validate. Check your connection.");
      onValidated(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Connect to Claude</h2>
      <p className="text-sm text-muted-foreground">
        MnM uses the Claude API for drift analysis and agent orchestration. Your
        credentials are stored locally and never sent to any service other than
        Anthropic.
      </p>

      {/* Method toggle */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            !isSetupToken
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => {
            setMethod("api_key");
            setKey("");
            setStatus("idle");
            setErrorMsg(null);
          }}
        >
          <Key className="mr-1.5 inline h-3.5 w-3.5" />
          API Key
        </button>
        <button
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            isSetupToken
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => {
            setMethod("setup_token");
            setKey("");
            setStatus("idle");
            setErrorMsg(null);
          }}
        >
          <Terminal className="mr-1.5 inline h-3.5 w-3.5" />
          Setup Token
        </button>
      </div>

      {isSetupToken && (
        <div className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">
            How to get a setup token:
          </p>
          <ol className="list-decimal list-inside space-y-0.5 text-xs">
            <li>
              Open a terminal and run{" "}
              <code className="rounded bg-muted px-1">claude setup-token</code>
            </li>
            <li>
              Copy the token that starts with{" "}
              <code className="rounded bg-muted px-1">sk-ant-oat...</code>
            </li>
            <li>Paste it below</li>
          </ol>
          <p className="text-xs mt-2">
            Uses your Claude subscription — no separate API billing.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="auth-token">
          {isSetupToken ? "Setup Token" : "API Key"}
        </Label>
        <Input
          id="auth-token"
          type="password"
          placeholder={isSetupToken ? "sk-ant-oat01-..." : "sk-ant-api03-..."}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="font-mono"
          onKeyDown={(e) => e.key === "Enter" && validateKey()}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button
          onClick={validateKey}
          disabled={!key.trim() || status === "checking"}
        >
          {status === "checking" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Validate & Save
        </Button>
        {status === "valid" && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Connected
          </span>
        )}
        {status === "invalid" && (
          <span className="flex items-center gap-1 text-sm text-destructive">
            <XCircle className="h-4 w-4" /> {errorMsg ?? "Invalid"}
          </span>
        )}
      </div>

      {!isSetupToken && (
        <p className="text-xs text-muted-foreground">
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Where to find your API key
          </a>
        </p>
      )}

      {/* Privacy notice */}
      <div className="rounded-md border p-3 text-xs text-muted-foreground">
        <p className="font-medium">Privacy</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>All data stored locally in .mnm/</li>
          <li>Only external calls: Claude API (api.anthropic.com)</li>
          <li>No telemetry by default</li>
        </ul>
      </div>
    </div>
  );
}
