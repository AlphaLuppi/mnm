/**
 * WorkflowStudio (U13.8) — multi-file editor for a governed workflow.
 *
 * Two-pane layout (resizable): FileTree on the left, MonacoMultiEditor on the
 * right. A 3rd column (AI Assistant Panel) will slot in at U14 — look for the
 * TODO marker below.
 *
 * Responsibilities of this page:
 *  - Read :name from the URL and pair it with the active company.
 *  - Query the detail endpoint for metadata (latestGitTag + parseError banner).
 *  - Delegate all file-buffer state to useWorkflowFiles.
 *  - Provide the Save / Discard / Add file / Delete file dialogs.
 *  - Gate edit-mode actions behind the workflows:create permission.
 *
 * Create-mode (`/workflows/new`) intentionally stays on the legacy single-file
 * GovernedWorkflowEditor — this studio only handles existing workflows.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@/lib/router";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { governedWorkflowsApi } from "@/api/governed-workflows";
import { queryKeys } from "@/lib/queryKeys";
import { usePermissions } from "@/hooks/usePermissions";
import { useWorkflowFiles } from "@/hooks/useWorkflowFiles";
import { FileTree } from "@/components/workflow-studio/FileTree";
import { MonacoMultiEditor } from "@/components/workflow-studio/MonacoMultiEditor";
import { AiAssistantPanel } from "@/components/workflow-studio/AiAssistantPanel";
import { ValidationBadge } from "@/components/workflow-studio/ValidationBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Save, Undo2 } from "lucide-react";

/** Shape of the error envelope our mutations raise (from governed-workflows REST). */
interface GovernedWorkflowErrorBody {
  error_code?: string;
  message?: string;
  hints?: string[];
}

/**
 * Extract a `{message, hints[]}` payload from an error raised by the API
 * client. The server's error contract is `{isError, error_code, message,
 * hints[]}` — the HTTP layer in `api/client.ts` surfaces it as an Error with
 * a `.body` field when available. Gracefully falls back to `error.message`.
 */
function extractErrorBody(err: unknown): GovernedWorkflowErrorBody {
  if (!err) return {};
  const maybeBody = (err as { body?: unknown }).body;
  if (maybeBody && typeof maybeBody === "object") {
    const b = maybeBody as GovernedWorkflowErrorBody;
    return {
      error_code: b.error_code,
      message: b.message,
      hints: b.hints,
    };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: String(err) };
}

/** Path validation for Add-File dialog. Returns an error message or null. */
function validatePath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "Chemin requis";
  if (trimmed.startsWith("/")) return "Le chemin ne doit pas commencer par /";
  if (trimmed.includes("\\")) return "Utilisez / comme séparateur, pas \\";
  if (trimmed.includes("..")) return "Les segments .. ne sont pas autorisés";
  const segments = trimmed.split("/");
  for (const seg of segments) {
    if (!seg) return "Segments vides non autorisés";
    if (!/^[A-Za-z0-9._-]+$/.test(seg)) {
      return `Segment invalide: "${seg}" (caractères autorisés: lettres, chiffres, . _ -)`;
    }
  }
  return null;
}

/** Template for a brand-new file based on its extension. */
function templateFor(path: string): string {
  if (path.endsWith(".gate.ts")) {
    return [
      `import { defineGate } from "@mnm/governed-workflows";`,
      `export default defineGate(async (ctx) => {`,
      `  return { pass: true, report: "ok" };`,
      `});`,
      "",
    ].join("\n");
  }
  if (path.endsWith(".json")) return "{\n  \n}\n";
  return "";
}

export function WorkflowStudio() {
  const { name } = useParams<{ name?: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("workflows:create");

  useEffect(() => {
    setBreadcrumbs([
      { label: "Workflows gouvernés", href: "/workflows" },
      { label: name ?? "" },
    ]);
  }, [setBreadcrumbs, name]);

  // Detail query — used for the git-tag badge + parseError banner. The files
  // themselves come from useWorkflowFiles (separate endpoint).
  const detailQuery = useQuery({
    queryKey: queryKeys.governedWorkflows.detail(selectedCompanyId!, name!),
    queryFn: () => governedWorkflowsApi.get(selectedCompanyId!, name!),
    enabled: !!selectedCompanyId && !!name,
  });

  const {
    tree,
    files,
    activePath,
    setActivePath,
    editFile,
    addFile,
    deleteFile,
    discardAll,
    dirtyCount,
    dirtyPaths,
    save,
    isLoadingTree,
    isSaving,
    saveError,
  } = useWorkflowFiles({
    companyId: selectedCompanyId ?? "",
    name: name ?? "",
  });

  // Dialog state
  const [saveOpen, setSaveOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [lastSavedTag, setLastSavedTag] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDir, setAddDir] = useState<string>("");
  const [addPath, setAddPath] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [deletePath, setDeletePath] = useState<string | null>(null);
  const [discardAllOpen, setDiscardAllOpen] = useState(false);
  const [parseErrorDismissed, setParseErrorDismissed] = useState(false);

  const parseError = detailQuery.data?.parseError;
  const latestTag = detailQuery.data?.definition?.latestGitTag ?? null;

  // Merge committed tree with locally-added files (from addFile / AI apply) so
  // the FileTree surfaces pending creations immediately. Without this, a user
  // who accepts an AI proposal for a new file sees it in Monaco but not in the
  // tree — confusing enough to look broken.
  const displayTree = useMemo(() => {
    const committedPaths = new Set((tree ?? []).map((e) => e.path));
    const extras = Object.keys(files)
      .filter((p) => !committedPaths.has(p))
      .map((p) => ({ path: p, type: "blob" as const, sha: "", size: null }));
    return [...(tree ?? []), ...extras];
  }, [tree, files]);

  const saveErrorBody = useMemo(() => extractErrorBody(saveError), [saveError]);

  async function handleSave() {
    if (!commitMessage.trim()) return;
    try {
      const result = await save(commitMessage.trim());
      setLastSavedTag(result.newGitTag);
      setCommitMessage("");
      setSaveOpen(false);
    } catch {
      // Error is surfaced by saveError state; keep the dialog open so the
      // user can retry or cancel.
    }
  }

  function handleOpenAddDialog(parentDir: string) {
    setAddDir(parentDir);
    setAddPath(parentDir ? `${parentDir}/` : "");
    setAddError(null);
    setAddOpen(true);
  }

  function handleConfirmAdd() {
    const err = validatePath(addPath);
    if (err) {
      setAddError(err);
      return;
    }
    if (files[addPath]) {
      setAddError("Ce fichier existe déjà");
      return;
    }
    addFile(addPath, templateFor(addPath));
    setAddOpen(false);
    setAddPath("");
    setAddDir("");
    setAddError(null);
  }

  function handleConfirmDelete() {
    if (!deletePath) return;
    deleteFile(deletePath);
    setDeletePath(null);
  }

  function handleConfirmDiscardAll() {
    discardAll();
    setDiscardAllOpen(false);
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold truncate">{name}</h1>
          <Badge variant="outline">{latestTag ?? "no tag"}</Badge>
          {lastSavedTag && (
            <span className="text-xs text-muted-foreground">
              Enregistré: <span className="font-mono">{lastSavedTag}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 && canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDiscardAllOpen(true)}
              title="Annuler toutes les modifications non enregistrées"
            >
              <Undo2 className="h-3.5 w-3.5 mr-1.5" />
              Tout annuler
            </Button>
          )}
          <Button
            onClick={() => setSaveOpen(true)}
            disabled={dirtyCount === 0 || !canEdit}
          >
            <Save className="h-4 w-4 mr-1.5" />
            Enregistrer ({dirtyCount})
          </Button>
        </div>
      </div>

      {/* Parse error banner (from detail query) */}
      {parseError && !parseErrorDismissed && (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium text-destructive">
              Impossible de charger la definition depuis git : {parseError.error_code}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setParseErrorDismissed(true)}
            >
              Fermer
            </Button>
          </div>
          <div className="text-muted-foreground mt-1 font-mono text-xs whitespace-pre-wrap">
            {parseError.message}
          </div>
          {parseError.hints.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
              {parseError.hints.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Main split: FileTree | Monaco | AI Assistant */}
      <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
            <div className="h-full bg-muted/20">
              {isLoadingTree ? (
                <div className="flex flex-col gap-1 p-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-5 w-full" />
                  ))}
                </div>
              ) : (
                <FileTree
                  tree={displayTree}
                  activePath={activePath}
                  dirtyPaths={dirtyPaths}
                  onSelect={setActivePath}
                  onAddFile={canEdit ? handleOpenAddDialog : undefined}
                  onDelete={canEdit ? (p) => setDeletePath(p) : undefined}
                  isLoading={isLoadingTree}
                />
              )}
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={55} minSize={30}>
            <div className="h-full min-h-0 relative">
              <MonacoMultiEditor
                files={files}
                activePath={activePath}
                onChange={editFile}
                readOnly={!canEdit}
              />
              <div className="absolute bottom-2 right-2 z-10">
                <ValidationBadge
                  activePath={activePath}
                  activeContent={
                    activePath ? files[activePath]?.content : undefined
                  }
                />
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={25} minSize={18} maxSize={40}>
            {selectedCompanyId && name ? (
              <AiAssistantPanel
                companyId={selectedCompanyId}
                workflowName={name}
                enabled={canEdit}
                onApplyFile={(proposal) => {
                  if (proposal.delete) return deleteFile(proposal.path);
                  if (files[proposal.path]) {
                    editFile(proposal.path, proposal.content ?? "");
                  } else {
                    addFile(proposal.path, proposal.content ?? "");
                  }
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground p-3">
                Assistant IA indisponible.
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Dirty-count status line */}
      <div className="flex-shrink-0 text-xs text-muted-foreground">
        {dirtyCount > 0
          ? `${dirtyCount} fichier(s) modifié(s) — pensez à enregistrer.`
          : "Tous les fichiers sont à jour."}
      </div>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer les modifications</DialogTitle>
            <DialogDescription>
              {dirtyCount} fichier(s) seront commités en une seule opération atomique.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Textarea
              placeholder="ex: fix: correction de la gate de précondition"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              rows={3}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Le backend calculera le prochain patch-bump automatiquement.
            </p>
            {saveError && (
              <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs space-y-1">
                <div className="text-destructive font-medium">
                  {saveErrorBody.error_code ? `${saveErrorBody.error_code}: ` : ""}
                  {saveErrorBody.message ?? "Erreur lors de la sauvegarde."}
                </div>
                {saveErrorBody.hints && saveErrorBody.hints.length > 0 && (
                  <ul className="list-disc pl-4 text-muted-foreground">
                    {saveErrorBody.hints.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveOpen(false)}
              disabled={isSaving}
            >
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

      {/* Add-file dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un fichier</DialogTitle>
            <DialogDescription>
              {addDir
                ? `Dans le dossier ${addDir}/ — saisissez le chemin complet.`
                : "Chemin relatif au workflow."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Input
              placeholder="gates/my-check.gate.ts"
              value={addPath}
              onChange={(e) => {
                setAddPath(e.target.value);
                setAddError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmAdd();
              }}
              autoFocus
            />
            {addError && <p className="text-xs text-destructive">{addError}</p>}
            <p className="text-xs text-muted-foreground">
              Extensions reconnues: <span className="font-mono">.json</span>,{" "}
              <span className="font-mono">.gate.ts</span>. Un template par défaut est
              inséré selon l'extension.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmAdd}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={deletePath !== null}
        onOpenChange={(open) => {
          if (!open) setDeletePath(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce fichier ?</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer{" "}
              <span className="font-mono text-foreground">{deletePath}</span> ? Cette
              action sera incluse dans le prochain commit — aucune donnée n'est perdue
              tant que vous n'avez pas enregistré.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discard-all confirm */}
      <AlertDialog open={discardAllOpen} onOpenChange={setDiscardAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler toutes les modifications ?</AlertDialogTitle>
            <AlertDialogDescription>
              {dirtyCount} fichier(s) reviendront à leur état commité. Cette action est
              irréversible côté UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Garder</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDiscardAll}>
              Tout annuler
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
