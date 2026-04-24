import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "@/lib/router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { governedWorkflowsApi } from "../api/governed-workflows";
import { queryKeys } from "../lib/queryKeys";
import { workflowDefinitionSchema } from "@mnm/governed-workflows";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Save } from "lucide-react";
import type { WorkflowDefinition } from "@mnm/governed-workflows";

// Lazy-load Monaco to keep initial bundle small
const Monaco = lazy(() => import("@monaco-editor/react"));

const DEFAULT_DEFINITION = JSON.stringify(
  {
    apiVersion: "mnm/v1",
    kind: "Workflow",
    metadata: { name: "my-workflow", description: "" },
    variables: {},
    steps: [],
  } satisfies WorkflowDefinition,
  null,
  2,
);

interface ValidationError {
  path: string;
  message: string;
}

function validateDefinition(raw: string): { parsed: WorkflowDefinition | null; errors: ValidationError[] } {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return {
      parsed: null,
      errors: [{ path: "JSON", message: "JSON invalide — vérifiez la syntaxe." }],
    };
  }

  const result = workflowDefinitionSchema.safeParse(obj);
  if (result.success) {
    return { parsed: result.data, errors: [] };
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
  return { parsed: null, errors };
}

export function GovernedWorkflowEditor() {
  const { name } = useParams<{ name?: string }>();
  const isEdit = Boolean(name);
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const { setBreadcrumbs } = useBreadcrumbs();

  const [jsonValue, setJsonValue] = useState<string>(DEFAULT_DEFINITION);
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Workflows gouvernés", to: "/workflows" },
      { label: isEdit ? name! : "Nouveau workflow" },
    ]);
  }, [setBreadcrumbs, isEdit, name]);

  // Fetch existing definition in edit mode
  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: queryKeys.governedWorkflows.detail(selectedCompanyId!, name!),
    queryFn: () => governedWorkflowsApi.get(selectedCompanyId!, name!),
    enabled: isEdit && !!selectedCompanyId && !!name,
  });

  // Sync fetched definition into editor state once loaded
  useEffect(() => {
    if (existing?.parsed?.workflow) {
      setJsonValue(JSON.stringify(existing.parsed.workflow, null, 2));
    }
  }, [existing]);

  const { parsed, errors } = useMemo(() => validateDefinition(jsonValue), [jsonValue]);

  const saveValid = parsed !== null && commitMessage.trim().length > 0;

  const createMutation = useMutation({
    mutationFn: (input: { definition: WorkflowDefinition; commitMessage: string }) =>
      governedWorkflowsApi.create(selectedCompanyId!, input),
    onSuccess: (result) => {
      const wfName = (parsed as WorkflowDefinition | null)?.metadata?.name ?? "workflow";
      setShowSaveDialog(false);
      navigate(`/workflows/${encodeURIComponent(wfName)}/runs`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { definition: WorkflowDefinition; commitMessage: string }) =>
      governedWorkflowsApi.update(selectedCompanyId!, name!, input),
    onSuccess: () => {
      setShowSaveDialog(false);
      navigate(`/workflows/${encodeURIComponent(name!)}/runs`);
    },
  });

  function handleSave() {
    if (!parsed || !commitMessage.trim()) return;
    if (isEdit) {
      updateMutation.mutate({ definition: parsed, commitMessage });
    } else {
      createMutation.mutate({ definition: parsed, commitMessage });
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const saveError = createMutation.error ?? updateMutation.error;

  if (isEdit && loadingExisting) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {isEdit ? `Modifier "${name}"` : "Nouveau workflow"}
        </h1>
        <Button
          onClick={() => setShowSaveDialog(true)}
          disabled={!saveValid}
        >
          <Save className="h-4 w-4 mr-1.5" />
          Enregistrer
        </Button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Editor pane */}
        <div className="flex-1 min-h-[60vh] border rounded-md overflow-hidden">
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <Monaco
              height="60vh"
              language="json"
              value={jsonValue}
              onChange={(v) => setJsonValue(v ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                scrollBeyondLastLine: false,
                wordWrap: "on",
              }}
              data-testid="monaco-editor"
            />
          </Suspense>
        </div>

        {/* Validation panel */}
        <div className="w-72 flex-shrink-0 border rounded-md p-4 overflow-auto">
          <h2 className="text-sm font-semibold mb-3">Validation</h2>
          {errors.length === 0 ? (
            <p className="text-sm text-green-600 dark:text-green-400">
              Aucune erreur — definition valide.
            </p>
          ) : (
            <ul className="space-y-2">
              {errors.map((e, i) => (
                <li key={i} className="flex gap-2 text-xs">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-mono text-muted-foreground">{e.path}: </span>
                    <span className="text-destructive">{e.message}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Save dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message de commit</DialogTitle>
            <DialogDescription>
              Ce message sera associé au commit git de la definition du workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="ex: fix: correction des gates de validation"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              rows={3}
            />
            {saveError && (
              <p className="mt-2 text-xs text-destructive">
                {saveError instanceof Error ? saveError.message : "Erreur lors de la sauvegarde."}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)} disabled={isSaving}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={!commitMessage.trim() || isSaving}
            >
              {isSaving ? "Enregistrement..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
