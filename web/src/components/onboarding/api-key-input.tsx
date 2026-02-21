"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Key, CheckCircle2, ExternalLink, AlertCircle } from "lucide-react";

interface ApiKeyInputProps {
  onSuccess: () => void;
}

export function ApiKeyInput({ onSuccess }: ApiKeyInputProps) {
  const [apiKey, setApiKey] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (!apiKey.trim()) return;

    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch("/api/settings/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), save: true }),
      });

      const result = await response.json();

      if (result.valid) {
        setSuccess(true);
        setTimeout(() => onSuccess(), 1000);
      } else {
        setError(result.error ?? "Invalid API key");
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
        <span className="text-sm font-medium">API key saved!</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Key className="h-4 w-4 text-primary" />
        Anthropic API Key
      </div>

      <div className="flex gap-2">
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="font-mono text-sm"
          disabled={isValidating}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <Button
          onClick={handleSubmit}
          disabled={!apiKey.trim() || isValidating}
        >
          {isValidating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Connect"
          )}
        </Button>
      </div>

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

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
