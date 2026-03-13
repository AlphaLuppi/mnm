"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Key,
  Terminal,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

interface ApiKeyInputProps {
  onSuccess: () => void;
}

type AuthMethod = "api_key" | "setup_token";

export function ApiKeyInput({ onSuccess }: ApiKeyInputProps) {
  const [method, setMethod] = useState<AuthMethod>("api_key");
  const [token, setToken] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (!token.trim()) return;

    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch("/api/settings/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: token.trim() }),
      });

      const result = await response.json();

      if (result.valid) {
        setSuccess(true);
        setTimeout(() => onSuccess(), 1000);
      } else {
        setError(result.error ?? "Invalid credentials");
      }
    } catch {
      setError("Failed to validate. Please try again.");
    } finally {
      setIsValidating(false);
    }
  }

  if (success) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-medium">
          {method === "setup_token"
            ? "Setup token saved!"
            : "API key saved!"}
        </span>
      </div>
    );
  }

  const isSetupToken = method === "setup_token";

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          {isSetupToken ? (
            <Terminal className="h-4 w-4 text-primary" />
          ) : (
            <Key className="h-4 w-4 text-primary" />
          )}
          {isSetupToken ? "Setup Token" : "Anthropic API Key"}
        </div>
        <button
          type="button"
          onClick={() => {
            setMethod(isSetupToken ? "api_key" : "setup_token");
            setToken("");
            setError(null);
          }}
          className="text-xs text-primary hover:underline"
        >
          {isSetupToken ? "or use an API Key" : "or use a Setup Token"}
        </button>
      </div>

      {isSetupToken && (
        <p className="text-xs text-muted-foreground">
          Run <code className="rounded bg-muted px-1">claude setup-token</code>{" "}
          in your terminal, then paste the token below. Uses your Claude
          subscription — no separate API billing.
        </p>
      )}

      <div className="flex gap-2">
        <Input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={isSetupToken ? "sk-ant-oat01-..." : "sk-ant-api03-..."}
          className="font-mono text-sm"
          disabled={isValidating}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <Button
          onClick={handleSubmit}
          disabled={!token.trim() || isValidating}
        >
          {isValidating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Connect"
          )}
        </Button>
      </div>

      {!isSetupToken && (
        <p className="text-xs text-muted-foreground">
          Get your API key from{" "}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            console.anthropic.com
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
