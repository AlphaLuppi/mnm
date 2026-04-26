import { useEffect } from "react";
import { useParams } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useGovernedRunEvents } from "../hooks/useGovernedRunEvents";
import { governedWorkflowsApi } from "../api/governed-workflows";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatDateTime } from "../lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import type { StepWithGates } from "../api/governed-workflows";
import type { GateResultRow } from "@mnm/shared";

const stepStateVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  running: "default",
  gate_eval: "default",
  succeeded: "outline",
  failed: "destructive",
};

const runStatusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  active: "default",
  completed: "outline",
  failed: "destructive",
};

function StateIcon({ state }: { state: string }) {
  if (state === "succeeded") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (state === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function GatesTable({ gates }: { gates: GateResultRow[] }) {
  if (gates.length === 0) {
    return <p className="text-xs text-muted-foreground">Aucune gate pour ce step.</p>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground border-b">
          <tr>
            <th className="px-2 py-1 text-left">ID</th>
            <th className="px-2 py-1 text-left">Kind</th>
            <th className="px-2 py-1 text-left">Pass</th>
            <th className="px-2 py-1 text-left">Rapport</th>
            <th className="px-2 py-1 text-left">Code erreur</th>
            <th className="px-2 py-1 text-left">Hints</th>
            <th className="px-2 py-1 text-left">Commit</th>
          </tr>
        </thead>
        <tbody>
          {gates.map((g) => (
            <tr key={g.id} className="border-b last:border-0">
              <td className="px-2 py-1 font-mono">{g.gateIdInJson}</td>
              <td className="px-2 py-1">{g.kind}</td>
              <td className="px-2 py-1">
                <Badge variant={g.pass ? "outline" : "destructive"} className="text-xs">
                  {g.pass ? "OK" : "KO"}
                </Badge>
              </td>
              <td className="px-2 py-1 max-w-xs truncate text-muted-foreground">{g.report || "—"}</td>
              <td className="px-2 py-1 font-mono">{g.errorCode || "—"}</td>
              <td className="px-2 py-1">
                {g.hints.length > 0 ? (
                  <ul className="list-disc list-inside space-y-0.5">
                    {g.hints.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-2 py-1 font-mono">{g.gateGitSha.slice(0, 7)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepCard({ step, index }: { step: StepWithGates; index: number }) {
  const promptContext = step.artifactsJson?.promptContext;
  const inputContent = promptContext
    ? JSON.stringify(promptContext, null, 2)
    : "— Aucun contexte disponible —";

  const outputContent =
    step.artifactsJson && Object.keys(step.artifactsJson).length > 0
      ? JSON.stringify(step.artifactsJson, null, 2)
      : "— Non exécuté —";

  return (
    <Card className="py-0">
      <CardHeader className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <StateIcon state={step.state} />
          <CardTitle className="text-sm font-semibold">
            {index + 1}. {step.stepIdInJson}
          </CardTitle>
          <Badge variant={stepStateVariant[step.state] ?? "secondary"} className="text-xs ml-auto">
            {step.state}
          </Badge>
        </div>
        {(step.startedAt || step.completedAt) && (
          <div className="flex gap-4 text-xs text-muted-foreground mt-1">
            {step.startedAt && <span>Démarré: {formatDateTime(step.startedAt)}</span>}
            {step.completedAt && <span>Terminé: {formatDateTime(step.completedAt)}</span>}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-4 py-3">
        <Tabs defaultValue="input">
          <TabsList>
            <TabsTrigger value="input">Input</TabsTrigger>
            <TabsTrigger value="output">Output</TabsTrigger>
            <TabsTrigger value="gates">Gates ({step.gateResults.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="input" className="mt-3">
            <pre className="text-xs bg-muted/40 rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">
              {inputContent}
            </pre>
          </TabsContent>
          <TabsContent value="output" className="mt-3">
            <pre className="text-xs bg-muted/40 rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">
              {outputContent}
            </pre>
          </TabsContent>
          <TabsContent value="gates" className="mt-3">
            <GatesTable gates={step.gateResults} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export function GovernedWorkflowRunDetail() {
  const { name, runId } = useParams<{ name: string; runId: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  // Register live-event subscription — invalidates runDetail query on SSE events
  useGovernedRunEvents({ companyId: selectedCompanyId ?? "", runId: runId ?? "" });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Workflows gouvernés", href: "/workflows" },
      { label: name ?? "", href: `/workflows/${encodeURIComponent(name ?? "")}` },
      { label: "Runs", href: `/workflows/${encodeURIComponent(name ?? "")}/runs` },
      { label: runId?.slice(0, 8) ?? "" },
    ]);
  }, [setBreadcrumbs, name, runId]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.governedWorkflows.runDetail(selectedCompanyId!, runId!),
    queryFn: () => governedWorkflowsApi.getRun(selectedCompanyId!, name!, runId!),
    enabled: !!selectedCompanyId && !!name && !!runId,
  });

  if (isLoading) return <PageSkeleton variant="detail" />;

  if (error) {
    return (
      <div className="py-8 text-sm text-destructive">
        Erreur lors du chargement du run.
      </div>
    );
  }

  if (!data) return null;

  const { run, steps } = data;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">
            Run <span className="font-mono">{run.id.slice(0, 8)}</span>
          </h1>
          <Badge variant={runStatusVariant[run.status] ?? "secondary"}>
            {run.status}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Tag: <span className="font-mono">{run.workflowGitTag}</span></span>
          <span>SHA: <span className="font-mono">{run.workflowGitSha.slice(0, 7)}</span></span>
          {run.startedAt && <span>Démarré: {formatDateTime(run.startedAt)}</span>}
          {run.completedAt && <span>Terminé: {formatDateTime(run.completedAt)}</span>}
        </div>
      </div>

      {/* Steps timeline */}
      <div className="space-y-4">
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun step enregistré.</p>
        ) : (
          steps.map((step, i) => <StepCard key={step.id} step={step} index={i} />)
        )}
      </div>
    </div>
  );
}
