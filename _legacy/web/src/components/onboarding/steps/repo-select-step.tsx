"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface RepoSelectStepProps {
  value: string;
  onChange: (path: string) => void;
}

export function RepoSelectStep({ value, onChange }: RepoSelectStepProps) {
  const [status, setStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");

  async function validate(path: string) {
    onChange(path);
    if (!path.trim()) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    try {
      const res = await fetch(
        `/api/onboarding/validate-repo?path=${encodeURIComponent(path)}`
      );
      setStatus(res.ok ? "valid" : "invalid");
    } catch {
      setStatus("invalid");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Select Repository</h2>
      <p className="text-sm text-muted-foreground">
        Enter the path to your git repository. MnM will analyze specs and manage
        agents within this folder.
      </p>
      <div className="space-y-2">
        <Label htmlFor="repo-path">Repository Path</Label>
        <div className="flex items-center gap-2">
          <Input
            id="repo-path"
            placeholder="/path/to/your/project"
            value={value}
            onChange={(e) => validate(e.target.value)}
          />
          {status === "checking" && (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          )}
          {status === "valid" && (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
          {status === "invalid" && (
            <XCircle className="h-5 w-5 text-destructive" />
          )}
        </div>
        {status === "invalid" && (
          <p className="text-xs text-destructive">
            Not a valid git repository. Please check the path.
          </p>
        )}
      </div>
    </div>
  );
}
