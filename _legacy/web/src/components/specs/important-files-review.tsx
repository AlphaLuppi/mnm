"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Check, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ImportantFile {
  id: string;
  filePath: string;
  fileType: string;
  userConfirmed: number;
}

const TYPE_COLORS: Record<string, string> = {
  ProductBrief: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  Prd: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Story: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Architecture: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  Config: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export function ImportantFilesReview() {
  const { data, error, mutate } = useSWR("/api/git/important-files", fetcher);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});

  async function runDetection() {
    setDetecting(true);
    try {
      await fetch("/api/git/important-files", { method: "POST" });
      await mutate();
    } finally {
      setDetecting(false);
    }
  }

  async function saveConfirmations() {
    setSaving(true);
    try {
      const updates = Object.entries(confirmations).map(([id, confirmed]) => ({
        id,
        userConfirmed: confirmed,
      }));
      await fetch("/api/git/important-files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      await mutate();
      setConfirmations({});
    } finally {
      setSaving(false);
    }
  }

  const files: ImportantFile[] = data?.files ?? [];
  const hasChanges = Object.keys(confirmations).length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Important Files</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={runDetection}
          disabled={detecting}
        >
          {detecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Detect Files
            </>
          )}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">Failed to load important files.</p>
      )}

      {files.length === 0 && !detecting && (
        <p className="text-sm text-muted-foreground">
          No important files detected yet. Click &quot;Detect Files&quot; to scan your repository.
        </p>
      )}

      {files.length > 0 && (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left font-medium">File</th>
                <th className="p-2 text-left font-medium">Type</th>
                <th className="p-2 text-center font-medium">Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => {
                const isConfirmed =
                  confirmations[file.id] ?? file.userConfirmed === 1;
                return (
                  <tr key={file.id} className="border-b last:border-0">
                    <td className="p-2 font-mono text-xs">{file.filePath}</td>
                    <td className="p-2">
                      <Badge
                        variant="secondary"
                        className={TYPE_COLORS[file.fileType] ?? ""}
                      >
                        {file.fileType}
                      </Badge>
                    </td>
                    <td className="p-2 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          setConfirmations((prev) => ({
                            ...prev,
                            [file.id]: !isConfirmed,
                          }))
                        }
                      >
                        {isConfirmed ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={saveConfirmations} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
