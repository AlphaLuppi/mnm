"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { MnMConfig } from "@/lib/core/config";

interface ApiTabProps {
  config: MnMConfig;
  onUpdate: (patch: Record<string, unknown>) => void;
}

export function ApiTab({ config, onUpdate }: ApiTabProps) {
  const [newKey, setNewKey] = useState("");
  const [editing, setEditing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [keyStatus, setKeyStatus] = useState<"idle" | "valid" | "invalid">("idle");

  async function validateAndSave() {
    if (!newKey.trim()) return;
    setValidating(true);
    try {
      const res = await fetch("/api/settings/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: newKey }),
      });
      if (res.ok) {
        setKeyStatus("valid");
        setEditing(false);
        setNewKey("");
      } else {
        setKeyStatus("invalid");
      }
    } catch {
      setKeyStatus("invalid");
    } finally {
      setValidating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">API Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Claude API Key</Label>
          {!editing ? (
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 text-sm">
                sk-ant-...****
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Update
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="sk-ant-..."
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={validateAndSave}
                  disabled={validating || !newKey.trim()}
                >
                  {validating && (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  )}
                  Validate & Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setNewKey("");
                    setKeyStatus("idle");
                  }}
                >
                  Cancel
                </Button>
                {keyStatus === "valid" && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                {keyStatus === "invalid" && (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
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
        </div>
      </CardContent>
    </Card>
  );
}
