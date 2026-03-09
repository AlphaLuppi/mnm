"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface DiscoveredAgentType {
  id: string;
  name: string;
  description: string;
  source: string;
}

interface LaunchAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAgentType?: string;
  specId?: string;
  specTitle?: string;
  onLaunched?: () => void;
}

export function LaunchAgentDialog({
  open,
  onOpenChange,
  initialAgentType,
  specId,
  specTitle,
  onLaunched,
}: LaunchAgentDialogProps) {
  const { data } = useSWR<{ agentTypes: DiscoveredAgentType[] }>(
    "/api/discovery/agents",
    fetcher
  );

  const agentTypes = data?.agentTypes ?? [];
  const [agentType, setAgentType] = useState(
    initialAgentType ?? agentTypes[0]?.id ?? ""
  );
  const [scopeInput, setScopeInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  function handleAddFile() {
    const trimmed = scopeInput.trim();
    if (trimmed && !selectedFiles.includes(trimmed)) {
      setSelectedFiles((prev) => [...prev, trimmed]);
      setScopeInput("");
    }
  }

  function handleRemoveFile(file: string) {
    setSelectedFiles((prev) => prev.filter((f) => f !== file));
  }

  async function handleLaunch() {
    if (selectedFiles.length === 0) {
      setError("Please specify at least one file in scope.");
      return;
    }

    setIsLaunching(true);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specId: specId ?? "manual",
          agentType,
          scope: selectedFiles,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error?.message ?? "Failed to launch agent");
        return;
      }
      onOpenChange(false);
      setSelectedFiles([]);
      setScopeInput("");
      setError(null);
      onLaunched?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsLaunching(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Launch Agent</DialogTitle>
          <DialogDescription>
            {specTitle
              ? `Launching for spec: ${specTitle}`
              : "Configure and launch an AI agent"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Agent Type</label>
            <Select value={agentType} onValueChange={setAgentType}>
              <SelectTrigger>
                <SelectValue placeholder="Select agent type" />
              </SelectTrigger>
              <SelectContent>
                {agentTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">File Scope</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="src/lib/example.ts"
                value={scopeInput}
                onChange={(e) => setScopeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddFile()}
              />
              <Button variant="outline" size="sm" onClick={handleAddFile}>
                Add
              </Button>
            </div>

            {selectedFiles.length > 0 && (
              <ScrollArea className="h-32 border rounded-md p-2">
                <div className="space-y-1">
                  {selectedFiles.map((file) => (
                    <div
                      key={file}
                      className="flex items-center gap-2 text-xs"
                    >
                      <Checkbox
                        checked
                        onCheckedChange={() => handleRemoveFile(file)}
                      />
                      <span className="font-mono truncate">{file}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleLaunch} disabled={isLaunching}>
            {isLaunching ? "Launching..." : "Launch Agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
