import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { lensesApi } from "../../api/lenses";
import { queryKeys } from "../../lib/queryKeys";
import { MarkdownBody } from "../MarkdownBody";
import { Button } from "@/components/ui/button";

interface LensAnalysisResultProps {
  companyId: string;
  traceId: string;
  lensId: string;
}

export function LensAnalysisResult({
  companyId,
  traceId,
  lensId,
}: LensAnalysisResultProps) {
  const queryClient = useQueryClient();

  // Try to fetch cached result
  const {
    data: result,
    isLoading: resultLoading,
    error: resultError,
  } = useQuery({
    queryKey: queryKeys.lenses.result(companyId, lensId, traceId),
    queryFn: () => lensesApi.getResult(companyId, lensId, traceId),
    enabled: !!companyId && !!lensId && !!traceId,
    retry: false,
  });

  // Cost estimate
  const { data: costEstimate } = useQuery({
    queryKey: queryKeys.lenses.costEstimate(companyId, traceId),
    queryFn: () => lensesApi.estimateCost(companyId, traceId),
    enabled: !!companyId && !!traceId && !result && !resultLoading,
  });

  // Run analysis mutation
  const analyzeMutation = useMutation({
    mutationFn: () => lensesApi.analyze(companyId, lensId, traceId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.lenses.result(companyId, lensId, traceId),
      });
    },
  });

  const hasResult = !!result && !resultError;
  const is404 =
    resultError &&
    typeof resultError === "object" &&
    "status" in resultError &&
    (resultError as { status: number }).status === 404;
  const needsAnalysis = is404 || (!result && !resultLoading && !resultError);
  const isAnalyzing = analyzeMutation.isPending;

  // Show cached result
  if (hasResult) {
    return (
      <div data-testid="trace-09-analysis-result" className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Analyzed {new Date(result.generatedAt).toLocaleString()} | {result.modelUsed} | ${result.costUsd.toFixed(4)}
          </span>
          <Button
            data-testid="trace-09-analysis-refresh"
            variant="ghost"
            size="sm"
            onClick={() => analyzeMutation.mutate()}
            disabled={isAnalyzing}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isAnalyzing ? "animate-spin" : ""}`} />
            Re-analyze
          </Button>
        </div>
        <div
          data-testid="trace-09-analysis-markdown"
          className="rounded-md border border-border bg-card p-4 prose prose-sm dark:prose-invert max-w-none"
        >
          <MarkdownBody>{result.resultMarkdown}</MarkdownBody>
        </div>
      </div>
    );
  }

  // Loading state
  if (resultLoading) {
    return (
      <div data-testid="trace-09-analysis-loading" className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking for cached analysis...
      </div>
    );
  }

  // Analyzing in progress
  if (isAnalyzing) {
    return (
      <div
        data-testid="trace-09-analysis-running"
        className="rounded-md border border-border bg-muted/30 px-4 py-6 flex flex-col items-center gap-3"
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Analyzing trace through your lens...</span>
      </div>
    );
  }

  // Analysis error
  if (analyzeMutation.error) {
    return (
      <div
        data-testid="trace-09-analysis-error"
        className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2"
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        Analysis failed: {analyzeMutation.error instanceof Error ? analyzeMutation.error.message : "Unknown error"}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => analyzeMutation.mutate()}
          className="ml-auto"
        >
          Retry
        </Button>
      </div>
    );
  }

  // Needs analysis — prompt user to launch
  if (needsAnalysis) {
    return (
      <div
        data-testid="trace-09-analysis-prompt"
        className="rounded-md border border-border bg-muted/30 px-4 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium">Ready to analyze</p>
            {costEstimate && (
              <p className="text-xs text-muted-foreground">
                ~{costEstimate.observationCount} observations | estimated cost: ${costEstimate.estimatedCostUsd.toFixed(4)}
              </p>
            )}
          </div>
        </div>
        <Button
          data-testid="trace-09-launch-analysis"
          size="sm"
          onClick={() => analyzeMutation.mutate()}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Run Analysis
        </Button>
      </div>
    );
  }

  // Unexpected error
  if (resultError) {
    return (
      <div
        data-testid="trace-09-result-error"
        className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2"
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        Failed to load analysis result.
      </div>
    );
  }

  return null;
}
