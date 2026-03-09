"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  FileSpreadsheet,
  Blocks,
  BookOpen,
  Settings,
  Loader2,
  Search,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  useDriftDetections,
  type ScanResult,
  type InferredScope,
} from "@/hooks/use-drift";

interface Spec {
  id: string;
  title: string | null;
  filePath: string;
  specType: string;
}

interface ScanDriftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedSpecId?: string;
}

const specTypeIcons: Record<string, React.ElementType> = {
  product_brief: FileText,
  prd: FileSpreadsheet,
  architecture: Blocks,
  story: BookOpen,
  config: Settings,
};

const specTypeLabels: Record<string, string> = {
  product_brief: "Product Brief",
  prd: "PRD",
  architecture: "Architecture",
  story: "Story",
  config: "Config",
};

type DialogStep = "select-spec" | "review-scope" | "scanning" | "result";

export function ScanDriftDialog({
  open,
  onOpenChange,
  preselectedSpecId,
}: ScanDriftDialogProps) {
  const [step, setStep] = useState<DialogStep>("select-spec");
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [selectedSpec, setSelectedSpec] = useState<Spec | null>(null);
  const [inferredScope, setInferredScope] = useState<InferredScope | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { triggerScan, inferScope, mutate } = useDriftDetections();

  // Fetch specs on mount
  useEffect(() => {
    if (open) {
      fetch("/api/specs")
        .then((r) => r.json())
        .then(async (data) => {
          const specList = data.specs ?? [];
          setSpecs(specList);
          // Auto-select if preselected
          if (preselectedSpecId) {
            const spec = specList.find((s: Spec) => s.id === preselectedSpecId);
            if (spec) {
              setSelectedSpec(spec);
              try {
                const scope = await inferScope(spec.id);
                setInferredScope(scope);
                setSelectedFiles(new Set(scope.files));
                setStep("review-scope");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to infer scope");
              }
            }
          }
        })
        .catch(() => setError("Failed to load specs"));
    }
  }, [open, preselectedSpecId, inferScope]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("select-spec");
      setSelectedSpec(null);
      setInferredScope(null);
      setSelectedFiles(new Set());
      setScanResult(null);
      setError(null);
    }
  }, [open]);

  async function handleSpecSelected(spec: Spec) {
    setSelectedSpec(spec);
    setError(null);

    try {
      const scope = await inferScope(spec.id);
      setInferredScope(scope);
      setSelectedFiles(new Set(scope.files));
      setStep("review-scope");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to infer scope");
    }
  }

  async function handleStartScan() {
    if (!selectedSpec) return;

    setScanning(true);
    setStep("scanning");
    setError(null);

    try {
      const result = await triggerScan(
        selectedSpec.id,
        Array.from(selectedFiles),
        false // We already have scope, no need to infer again
      );
      setScanResult(result);
      setStep("result");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setStep("review-scope");
    } finally {
      setScanning(false);
    }
  }

  function toggleFile(file: string) {
    const next = new Set(selectedFiles);
    if (next.has(file)) {
      next.delete(file);
    } else {
      next.add(file);
    }
    setSelectedFiles(next);
  }

  function toggleAll() {
    if (inferredScope) {
      if (selectedFiles.size === inferredScope.files.length) {
        setSelectedFiles(new Set());
      } else {
        setSelectedFiles(new Set(inferredScope.files));
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {step === "select-spec" && (
          <>
            <DialogHeader>
              <DialogTitle>Scan for Drift</DialogTitle>
              <DialogDescription>
                Select a spec to scan for code vs specification drift
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <ScrollArea className="h-80">
              <div className="space-y-1">
                {specs.map((spec) => {
                  const Icon = specTypeIcons[spec.specType] ?? FileText;
                  return (
                    <button
                      key={spec.id}
                      onClick={() => handleSpecSelected(spec)}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {spec.title ?? spec.filePath}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {spec.filePath}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {specTypeLabels[spec.specType] ?? spec.specType}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        {step === "review-scope" && selectedSpec && inferredScope && (
          <>
            <DialogHeader>
              <DialogTitle>Review Scope</DialogTitle>
              <DialogDescription>
                Files to scan for{" "}
                <span className="font-medium">{selectedSpec.title}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Badge
                  variant={inferredScope.confidence === "high" ? "default" : "secondary"}
                >
                  {inferredScope.confidence} confidence
                </Badge>
                <span className="text-muted-foreground">
                  {selectedFiles.size} of {inferredScope.files.length} files selected
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {selectedFiles.size === inferredScope.files.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>

            <ScrollArea className="h-64 rounded-md border p-2">
              <div className="space-y-1">
                {inferredScope.files.map((file) => (
                  <label
                    key={file}
                    className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedFiles.has(file)}
                      onCheckedChange={() => toggleFile(file)}
                    />
                    <span className="truncate text-sm font-mono">{file}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep("select-spec")}
              >
                Back
              </Button>
              <Button
                onClick={handleStartScan}
                disabled={selectedFiles.size === 0 || scanning}
              >
                {scanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Start Scan
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "scanning" && (
          <>
            <DialogHeader>
              <DialogTitle>Scanning for Drift</DialogTitle>
              <DialogDescription>
                Analyzing {selectedFiles.size} files against spec...
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">
                This may take a moment while we analyze the code...
              </p>
            </div>
          </>
        )}

        {step === "result" && scanResult && (
          <>
            <DialogHeader>
              <DialogTitle>Scan Complete</DialogTitle>
              <DialogDescription>
                {scanResult.detection.hasDrift
                  ? "Drift detected between code and spec"
                  : "No drift detected"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {scanResult.detection.hasDrift ? (
                  <AlertCircle className="h-8 w-8 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                )}
                <div>
                  <p className="font-medium">
                    {scanResult.detection.hasDrift ? "Drift Found" : "All Good"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Severity: {scanResult.detection.severity}
                  </p>
                </div>
              </div>

              <div className="rounded-md bg-muted p-3">
                <p className="text-sm font-medium">Summary</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {scanResult.detection.summary}
                </p>
              </div>

              {scanResult.detection.hasDrift && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm font-medium">Recommendation</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {scanResult.detection.recommendation}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              {scanResult.detection.hasDrift && (
                <Button
                  onClick={() => {
                    // Navigate to drift detail
                    window.location.href = `/drift/${scanResult.detection.id}`;
                  }}
                >
                  View Details
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
