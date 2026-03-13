"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { MnMConfig } from "@/lib/core/config";

interface GitTabProps {
  config: MnMConfig;
  onUpdate: (patch: Record<string, unknown>) => void;
}

export function GitTab({ config, onUpdate }: GitTabProps) {
  const [detecting, setDetecting] = useState(false);

  async function rerunDetection() {
    setDetecting(true);
    try {
      await fetch("/api/onboarding/detect-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoPath: config.repositoryPath }),
      });
    } finally {
      setDetecting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Git Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="auto-detect">Auto-detect Important Files</Label>
            <p className="text-xs text-muted-foreground">
              Scan for spec files on startup
            </p>
          </div>
          <Switch
            id="auto-detect"
            checked={config.autoDetectFiles}
            onCheckedChange={(v) => onUpdate({ autoDetectFiles: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="git-hooks">Git Hooks</Label>
            <p className="text-xs text-muted-foreground">
              Enable pre-commit and post-commit hooks
            </p>
          </div>
          <Switch
            id="git-hooks"
            checked={config.gitHooksEnabled}
            onCheckedChange={(v) => onUpdate({ gitHooksEnabled: v })}
          />
        </div>
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={rerunDetection}
            disabled={detecting}
          >
            {detecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Re-run File Detection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
