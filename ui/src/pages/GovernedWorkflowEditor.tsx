import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { governedWorkflowsApi } from "../api/governed-workflows";
import { queryKeys } from "../lib/queryKeys";
import { workflowDefinitionSchema, workflowJsonSchema } from "@mnm/governed-workflows";
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
import { AlertCircle, Save, Plus, GitBranchPlus, WrapText } from "lucide-react";
import type { WorkflowDefinition } from "@mnm/governed-workflows";
import type { OnMount, BeforeMount } from "@monaco-editor/react";
import type { editor as MonacoEditorNS } from "monaco-editor";

// Lazy-load Monaco to keep initial bundle small
const Monaco = lazy(() => import("@monaco-editor/react"));

/** JSON Schema URI used to register the governed workflow schema in Monaco */
const WORKFLOW_SCHEMA_URI = "https://mnm.local/schemas/governed-workflow.json";

/**
 * Register the governed workflow JSON Schema with Monaco's JSON language service.
 * Called once via the `beforeMount` prop — fires before the editor mounts,
 * guaranteeing schema-backed validation from the first keystroke.
 */
const handleBeforeMount: BeforeMount = (monaco) => {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    schemas: [
      {
        uri: WORKFLOW_SCHEMA_URI,
        fileMatch: ["*"],
        schema: workflowJsonSchema as object,
      },
    ],
    enableSchemaRequest: false,
  });
};

const DEFAULT_DEFINITION = JSON.stringify(
  {
    apiVersion: "mnm/v1",
    kind: "GovernedWorkflow",
    name: "my-workflow",
    description: "",
    variables: {},
    steps: [{ id: "step-1", deps: [], agent: "my-agent", prompt_context: {} }],
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

/** Snippet inserted by "Insérer une étape" */
const STEP_SNIPPET = JSON.stringify(
  { id: "nouvelle-etape", deps: [], agent: "claude_code", prompt_context: {} },
  null,
  2,
);

/** Snippet inserted by "Insérer une gate" */
const GATE_SNIPPET = JSON.stringify(
  [{ id: "gate-1", source: "gates/precondition.gate.ts" }],
  null,
  2,
);

export function GovernedWorkflowEditor() {
  const { name } = useParams<{ name?: string }>();
  const isEdit = Boolean(name);
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setBreadcrumbs } = useBreadcrumbs();

  // Ref to the Monaco editor instance — used by toolbar snippet buttons
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const [jsonValue, setJsonValue] = useState<string>(DEFAULT_DEFINITION);
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Workflows gouvernés", href: "/workflows" },
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

  // Outer button gate: JSON must be valid. commitMessage is entered INSIDE the dialog.
  const jsonValid = parsed !== null;
  // Inner confirm button gate: commitMessage must be non-empty.
  const confirmEnabled = commitMessage.trim().length > 0;

  const createMutation = useMutation({
    mutationFn: (input: { definition: WorkflowDefinition; commitMessage: string }) =>
      governedWorkflowsApi.create(selectedCompanyId!, input),
    onSuccess: () => {
      const wfName = parsed?.name ?? "workflow";
      setShowSaveDialog(false);
      qc.invalidateQueries({ queryKey: queryKeys.governedWorkflows.list(selectedCompanyId!) });
      navigate(`/workflows/${encodeURIComponent(wfName)}/runs`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { definition: WorkflowDefinition; commitMessage: string }) =>
      governedWorkflowsApi.update(selectedCompanyId!, name!, input),
    onSuccess: () => {
      const newName = parsed?.name ?? name!;
      setShowSaveDialog(false);
      qc.invalidateQueries({ queryKey: queryKeys.governedWorkflows.list(selectedCompanyId!) });
      qc.invalidateQueries({ queryKey: queryKeys.governedWorkflows.detail(selectedCompanyId!, newName) });
      navigate(`/workflows/${encodeURIComponent(newName)}/runs`);
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

  /**
   * Insert a snippet at the current cursor position in the Monaco editor.
   * Falls back to appending at the end if no cursor is active.
   */
  function insertSnippet(text: string) {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    const op = selection
      ? { range: selection, text, forceMoveMarkers: true }
      : { range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }, text, forceMoveMarkers: true };
    editor.executeEdits("snippet-insert", [op]);
    editor.focus();
  }

  function handleInsertStep() {
    insertSnippet(STEP_SNIPPET);
  }

  function handleInsertGate() {
    insertSnippet(GATE_SNIPPET);
  }

  function handleFormat() {
    editorRef.current?.trigger("toolbar", "editor.action.formatDocument", undefined);
    editorRef.current?.focus();
  }

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
          disabled={!jsonValid}
        >
          <Save className="h-4 w-4 mr-1.5" />
          Enregistrer
        </Button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Editor pane */}
        <div className="flex-1 flex flex-col min-h-[60vh]">
          {/* Snippet toolbar */}
          <div className="flex items-center gap-2 pb-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleInsertStep}
              title="Insère un objet étape à la position du curseur"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Insérer une étape
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleInsertGate}
              title="Insère un bloc gate à la position du curseur"
            >
              <GitBranchPlus className="h-3.5 w-3.5 mr-1" />
              Insérer une gate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleFormat}
              title="Formater le JSON (Shift+Alt+F)"
            >
              <WrapText className="h-3.5 w-3.5 mr-1" />
              Formater
            </Button>
          </div>
          {/* Monaco editor */}
          <div className="flex-1 border rounded-md overflow-hidden">
            <Suspense fallback={<Skeleton className="h-full w-full" />}>
              <Monaco
                height="60vh"
                language="json"
                value={jsonValue}
                onChange={(v) => setJsonValue(v ?? "")}
                beforeMount={handleBeforeMount}
                onMount={handleEditorMount}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  folding: true,
                  lineNumbers: "on",
                  quickSuggestions: { other: true, comments: false, strings: true },
                  suggestOnTriggerCharacters: true,
                }}
                data-testid="monaco-editor"
              />
            </Suspense>
          </div>
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
          <div className="py-4 space-y-3">
            <Textarea
              placeholder="ex: fix: correction des gates de validation"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Le backend calculera le prochain patch-bump du tag (ex&nbsp;: <span className="font-mono">{parsed?.name ?? "workflow"}/vX.Y.Z</span>).
            </p>
            {saveError && (
              <p className="text-xs text-destructive">
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
              disabled={!confirmEnabled || isSaving}
            >
              {isSaving ? "Enregistrement..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
