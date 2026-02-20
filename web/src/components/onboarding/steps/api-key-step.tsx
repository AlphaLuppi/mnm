"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface ApiKeyStepProps {
  onValidated: (valid: boolean) => void;
}

export function ApiKeyStep({ onValidated }: ApiKeyStepProps) {
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");

  async function validateKey() {
    if (!key.trim()) return;
    setStatus("checking");
    try {
      const res = await fetch("/api/settings/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      const valid = res.ok;
      setStatus(valid ? "valid" : "invalid");
      onValidated(valid);
    } catch {
      setStatus("invalid");
      onValidated(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Configure Claude API Key</h2>
      <p className="text-sm text-muted-foreground">
        MnM uses the Claude API for drift analysis and agent orchestration.
        Your key is stored locally and never sent to any service other than
        Anthropic.
      </p>
      <div className="space-y-2">
        <Label htmlFor="api-key">API Key</Label>
        <Input
          id="api-key"
          type="password"
          placeholder="sk-ant-..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={validateKey} disabled={!key.trim() || status === "checking"}>
          {status === "checking" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Validate Key
        </Button>
        {status === "valid" && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Valid
          </span>
        )}
        {status === "invalid" && (
          <span className="flex items-center gap-1 text-sm text-destructive">
            <XCircle className="h-4 w-4" /> Invalid key
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        <a
          href="https://console.anthropic.com/account/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Where to find your API key
        </a>
      </p>

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
