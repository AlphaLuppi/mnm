import { useEffect, useState } from "react";
import { useParams, useNavigate } from "@/lib/router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { governedWorkflowsApi } from "../api/governed-workflows";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { formatDateTime } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Play, GitBranch } from "lucide-react";
import type { GovernedRunRow } from "@mnm/shared";

const STATUS_OPTIONS = ["", "draft", "active", "completed", "failed"] as const;

const runStatusVariant: Record<string, string> = {
  draft: "secondary",
  active: "default",
  completed: "outline",
  failed: "destructive",
};

export function GovernedWorkflowRuns() {
  const { name } = useParams<{ name: string }>();
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const { setBreadcrumbs } = useBreadcrumbs();

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [initiatedByFilter, setInitiatedByFilter] = useState<string>("");
  const [startedAfter, setStartedAfter] = useState<string>("");
  const [startedBefore, setStartedBefore] = useState<string>("");

  const [showLaunchDialog, setShowLaunchDialog] = useState(false);
  const [launchFromHead, setLaunchFromHead] = useState(false);
  const [launchParams, setLaunchParams] = useState<string>("{}");

  useEffect(() => {
    setBreadcrumbs([
      { label: "Workflows gouvernés", href: "/workflows" },
      { label: name ?? "", href: `/workflows/${encodeURIComponent(name ?? "")}` },
      { label: "Runs" },
    ]);
  }, [setBreadcrumbs, name]);

  const filters = {
    status: statusFilter || undefined,
    initiatedByActorId: initiatedByFilter || undefined,
    startedAfter: startedAfter || undefined,
    startedBefore: startedBefore || undefined,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.governedWorkflows.runs(selectedCompanyId!, name!, filters),
    queryFn: () => governedWorkflowsApi.listRuns(selectedCompanyId!, name!, filters),
    enabled: !!selectedCompanyId && !!name,
  });

  // Fetch workflow detail to derive variable definitions for the launch form
  const { data: workflowDetail } = useQuery({
    queryKey: queryKeys.governedWorkflows.detail(selectedCompanyId!, name!),
    queryFn: () => governedWorkflowsApi.get(selectedCompanyId!, name!),
    enabled: !!selectedCompanyId && !!name && showLaunchDialog,
  });

  useEffect(() => {
    if (workflowDetail?.parsed?.workflow?.variables) {
      const variables = workflowDetail.parsed.workflow.variables;
      const defaults: Record<string, unknown> = {};
      for (const [key] of Object.entries(variables)) {
        defaults[key] = "";
      }
      setLaunchParams(JSON.stringify(defaults, null, 2));
    }
  }, [workflowDetail]);

  const launchMutation = useMutation({
    mutationFn: () => {
      let params: Record<string, unknown> = {};
      try {
        params = JSON.parse(launchParams);
      } catch {
        // ignore parse error — will be caught by the form
      }
      return governedWorkflowsApi.launchRun(selectedCompanyId!, name!, {
        params,
        gitTagPreference: launchFromHead ? "HEAD" : "latest",
      });
    },
    onSuccess: (result) => {
      setShowLaunchDialog(false);
      navigate(`/workflows/${encodeURIComponent(name!)}/runs/${result.runId}`);
    },
  });

  function handleRowClick(row: GovernedRunRow) {
    navigate(`/workflows/${encodeURIComponent(name!)}/runs/${row.id}`);
  }

  if (isLoading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="py-8 text-sm text-destructive">
        Erreur lors du chargement des runs.
      </div>
    );
  }

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Runs — <span className="font-mono text-base">{name}</span>
        </h1>
        <Button onClick={() => setShowLaunchDialog(true)}>
          <Play className="h-4 w-4 mr-1.5" />
          Lancer un run
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s || "_all"}>
                {s || "Tous les statuts"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Lancé par (actorId)"
          value={initiatedByFilter}
          onChange={(e) => setInitiatedByFilter(e.target.value)}
          className="w-48"
        />
        <Input
          type="datetime-local"
          placeholder="Depuis"
          value={startedAfter}
          onChange={(e) => setStartedAfter(e.target.value)}
          className="w-52"
        />
        <Input
          type="datetime-local"
          placeholder="Jusqu'à"
          value={startedBefore}
          onChange={(e) => setStartedBefore(e.target.value)}
          className="w-52"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          message="Aucun run pour ce workflow."
          action="Lancer un run"
          onAction={() => setShowLaunchDialog(true)}
        />
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium">ID</th>
                <th className="px-4 py-2 text-left font-medium">Statut</th>
                <th className="px-4 py-2 text-left font-medium">Démarré le</th>
                <th className="px-4 py-2 text-left font-medium">Terminé le</th>
                <th className="px-4 py-2 text-left font-medium">Lancé par</th>
                <th className="px-4 py-2 text-left font-medium">Tag git</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => handleRowClick(row)}
                >
                  <td className="px-4 py-2 font-mono text-xs">{row.id.slice(0, 8)}</td>
                  <td className="px-4 py-2">
                    <Badge variant={(runStatusVariant[row.status] ?? "secondary") as "default" | "secondary" | "outline" | "destructive"}>
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {row.startedAt ? formatDateTime(row.startedAt) : "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {row.completedAt ? formatDateTime(row.completedAt) : "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs font-mono">
                    {row.initiatedByActorId.slice(0, 12)}
                  </td>
                  <td className="px-4 py-2">
                    {row.workflowGitTag ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {row.workflowGitTag}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Launch dialog */}
      <Dialog open={showLaunchDialog} onOpenChange={setShowLaunchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lancer un run</DialogTitle>
            <DialogDescription>
              Paramétrez le run et choisissez la version du workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Paramètres (JSON)</Label>
              <Textarea
                className="font-mono text-xs resize-none h-32"
                value={launchParams}
                onChange={(e) => setLaunchParams(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="launch-from-head"
                checked={launchFromHead}
                onCheckedChange={(v) => setLaunchFromHead(Boolean(v))}
              />
              <Label htmlFor="launch-from-head" className="cursor-pointer">
                Lancer depuis HEAD (non tagué)
              </Label>
            </div>
            {launchMutation.error && (
              <p className="text-xs text-destructive">
                {launchMutation.error instanceof Error
                  ? launchMutation.error.message
                  : "Erreur lors du lancement."}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLaunchDialog(false)}
              disabled={launchMutation.isPending}
            >
              Annuler
            </Button>
            <Button onClick={() => launchMutation.mutate()} disabled={launchMutation.isPending}>
              {launchMutation.isPending ? "Lancement..." : "Lancer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
