"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface DetectedFile {
  path: string;
  type: string;
  selected: boolean;
}

interface DetectFilesStepProps {
  repoPath: string;
}

export function DetectFilesStep({ repoPath }: DetectFilesStepProps) {
  const [files, setFiles] = useState<DetectedFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/onboarding/detect-files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoPath }),
    })
      .then((r) => r.json())
      .then((data) => {
        setFiles(
          (data.files ?? []).map((f: { path: string; type: string }) => ({
            ...f,
            selected: true,
          }))
        );
      })
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [repoPath]);

  function toggleFile(index: number) {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, selected: !f.selected } : f))
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Analyzing your repository...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Detected Important Files</h2>
      <p className="text-sm text-muted-foreground">
        We found {files.length} important files in your repository. You can
        adjust the selection below.
      </p>
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No spec files detected. You can add them later via Settings.
        </p>
      ) : (
        <div className="max-h-60 space-y-2 overflow-y-auto">
          {files.map((file, i) => (
            <div key={file.path} className="flex items-center gap-2">
              <Checkbox
                id={`file-${i}`}
                checked={file.selected}
                onCheckedChange={() => toggleFile(i)}
              />
              <Label htmlFor={`file-${i}`} className="flex-1 text-sm">
                <span className="font-mono">{file.path}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  ({file.type})
                </span>
              </Label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
