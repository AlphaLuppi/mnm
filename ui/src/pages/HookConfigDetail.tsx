import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Trash2 } from "lucide-react";

import {
  hooksApi,
  type CreateHookConfigPayload,
  type HookCatalog,
  type HookCatalogEntry,
  type HookConfig,
  type HookExecution,
  type HookPhase,
  type UpdateHookConfigPayload,
} from "../api/hooks";
import { queryKeys } from "../lib/queryKeys";
import { formatApiError } from "../lib/api-errors";
import {
  EMPTY_VISIBILITY_VALUE,
  type VisibilityValue,
} from "@mnm/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { VisibilityPicker } from "../components/visibility/VisibilityPicker";

const HOOK_REF_PATTERN = /^(canonical|shared|local):[a-z0-9][a-z0-9-]*$/;
const PHASES: HookPhase[] = [
  "before_run",
  "before_step",
  "after_step",
  "after_run",
];

export interface HookConfigDetailProps {
  companyId: string;
  open: boolean;
  onClose: () => void;
  canEnforce: boolean;
  /** create new vs edit existing config */
  mode: "create" | "edit";
  /** required when mode === "edit" */
  configId?: string;
}

interface FormState {
  name: string;
  hookRef: string;
  defaultConfigJsonRaw: string;
  visibility: VisibilityValue;
  enabled: boolean;
  enforced: boolean;
  enforcedPhases: HookPhase[];
}

export function emptyForm(): FormState {
  return {
    name: "",
    hookRef: "",
    defaultConfigJsonRaw: "{}",
    visibility: EMPTY_VISIBILITY_VALUE,
    enabled: true,
    enforced: false,
    enforcedPhases: [],
  };
}

/**
 * Pure helper — look up a catalog entry by full ref ("canonical:foo",
 * "shared:bar", "local:baz"). Exported for unit tests.
 *
 * Returns `undefined` if the ref is invalid, the catalog hasn't loaded yet,
 * or no entry matches. Callers fall back to `{}` for the defaultConfig
 * placeholder in that case (P2.1 in the P4-E plan — the canonical hooks
 * ship richer metadata in a follow-up task).
 */
export function findCatalogEntry(
  catalog: HookCatalog | undefined,
  ref: string,
): HookCatalogEntry | undefined {
  if (!catalog) return undefined;
  const trimmed = ref.trim();
  const colon = trimmed.indexOf(":");
  if (colon < 0) return undefined;
  const source = trimmed.slice(0, colon) as keyof HookCatalog;
  const list = catalog[source];
  if (!Array.isArray(list)) return undefined;
  return list.find((e) => e.ref === trimmed);
}

export function configToForm(c: HookConfig): FormState {
  return {
    name: c.name,
    hookRef: c.hookRef,
    defaultConfigJsonRaw: JSON.stringify(c.defaultConfigJson ?? {}, null, 2),
    visibility: {
      visibility: c.visibility,
      tagIds: c.tagIds,
      principalIds: c.principalIds,
    },
    enabled: c.enabled,
    enforced: c.enforced,
    enforcedPhases: [...c.enforcedPhases],
  };
}

/**
 * Pure helper — exported for unit tests without React Testing Library
 * (convention `CancelRunDialog.test.tsx`).
 *
 * Returns null when the form state is invalid (empty name, bad hook_ref
 * regex, JSON parse error, JSON not an object). Returns a valid
 * `CreateHookConfigPayload` otherwise. `enforcedPhases` is forced to []
 * when `enforced=false` to avoid stale state leaking on toggle.
 */
export function formToCreatePayload(
  form: FormState,
): CreateHookConfigPayload | null {
  if (form.name.trim().length === 0) return null;
  const ref = form.hookRef.trim();
  if (!HOOK_REF_PATTERN.test(ref)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(form.defaultConfigJsonRaw);
  } catch {
    return null;
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    return null;
  }

  return {
    name: form.name.trim(),
    hookRef: ref,
    defaultConfigJson: parsed as Record<string, unknown>,
    visibility: form.visibility.visibility,
    tagIds: form.visibility.tagIds,
    principalIds: form.visibility.principalIds,
    enabled: form.enabled,
    enforced: form.enforced,
    enforcedPhases: form.enforced ? form.enforcedPhases : [],
  };
}

export function HookConfigDetail({
  companyId,
  open,
  onClose,
  canEnforce,
  mode,
  configId,
}: HookConfigDetailProps) {
  const isCreating = mode === "create";
  const editingId = !isCreating ? configId ?? null : null;

  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: queryKeys.hooks.detail(companyId, editingId ?? ""),
    queryFn: () => hooksApi.get(companyId, editingId!),
    enabled: !!editingId,
  });

  const { data: executions } = useQuery({
    queryKey: queryKeys.hooks.executions(companyId, { configId: editingId }),
    queryFn: () =>
      hooksApi.listExecutions(companyId, {
        configId: editingId!,
        limit: 20,
      }),
    enabled: !!editingId,
  });

  // Sync form ← server config on edit; reset on create.
  useEffect(() => {
    if (isCreating) setForm(emptyForm());
    else if (config) setForm(configToForm(config));
  }, [isCreating, config]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateHookConfigPayload) =>
      hooksApi.create(companyId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.hooks.list(companyId),
      });
      onClose();
    },
    onError: (err: unknown) => setSubmitError(formatApiError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateHookConfigPayload) =>
      hooksApi.update(companyId, editingId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.hooks.list(companyId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.hooks.detail(companyId, editingId!),
      });
    },
    onError: (err: unknown) => setSubmitError(formatApiError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => hooksApi.remove(companyId, editingId!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.hooks.list(companyId),
      });
      onClose();
    },
    onError: (err: unknown) => setSubmitError(formatApiError(err)),
  });

  // ─── P2.1 — pre-fill defaultConfigJson when the user picks a hookRef ────
  // Lazy fetch the catalog only when creating; edit mode reuses the saved
  // defaultConfigJson. The catalog metadata is hydrated by the canonical
  // hooks (P4-G) — when missing we fall back to `{}`.
  const { data: catalog } = useQuery({
    queryKey: queryKeys.hooks.catalog(companyId),
    queryFn: () => hooksApi.catalog(companyId),
    enabled: isCreating && !!companyId,
  });

  useEffect(() => {
    if (!isCreating) return;
    const ref = form.hookRef.trim();
    if (!ref) return;
    // Only auto-fill while the textarea still holds the empty placeholder.
    const trimmed = form.defaultConfigJsonRaw.trim();
    if (trimmed !== "" && trimmed !== "{}") return;
    const entry = findCatalogEntry(catalog, ref);
    const defaults = entry?.defaultConfig ?? {};
    setForm((f) => ({
      ...f,
      defaultConfigJsonRaw: JSON.stringify(defaults, null, 2),
    }));
    // Intentionally omit `form.defaultConfigJsonRaw` from deps so the prefill
    // doesn't fight the user's edits — it only fires when the ref or catalog
    // changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreating, form.hookRef, catalog]);

  const payload = useMemo(() => formToCreatePayload(form), [form]);
  const canSubmit =
    payload !== null && (!form.enforced || canEnforce);

  function handleSubmit() {
    setSubmitError(null);
    if (!payload) return;
    if (isCreating) createMutation.mutate(payload);
    else if (editingId) updateMutation.mutate(payload);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="sm:max-w-2xl flex flex-col"
        data-testid="hooks-detail-sheet"
      >
        <SheetHeader>
          <SheetTitle>
            {isCreating ? "Nouvelle config hook" : config?.name ?? "Hook config"}
          </SheetTitle>
          <SheetDescription>
            Le code des hooks vit en git (canonical / shared / local). Cette
            config porte les métadonnées : visibility, enforced flag,
            default_config_json.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-1 py-4 space-y-5">
          {!isCreating && loadingConfig ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="hook-name">Nom</Label>
                <Input
                  id="hook-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  data-testid="hooks-form-name"
                  placeholder="Comment Jira on complete"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hook-ref">
                  Hook ref{" "}
                  <span className="text-xs text-muted-foreground">
                    (canonical: / shared: / local:)
                  </span>
                </Label>
                <Input
                  id="hook-ref"
                  value={form.hookRef}
                  onChange={(e) =>
                    setForm({ ...form, hookRef: e.target.value })
                  }
                  placeholder="canonical:jira-comment-on-complete"
                  data-testid="hooks-form-hook-ref"
                  className="font-mono text-sm"
                />
                {form.hookRef.length > 0 &&
                  !HOOK_REF_PATTERN.test(form.hookRef.trim()) && (
                    <p className="text-xs text-destructive">
                      Format attendu : {HOOK_REF_PATTERN.source}
                    </p>
                  )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hook-config-json">
                  Default config (JSON)
                </Label>
                {/* TODO(T2.9): swap to Monaco lazy editor with JSON schema validation. */}
                <Textarea
                  id="hook-config-json"
                  value={form.defaultConfigJsonRaw}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      defaultConfigJsonRaw: e.target.value,
                    })
                  }
                  rows={6}
                  className="font-mono text-xs"
                  data-testid="hooks-form-config-json"
                />
              </div>

              <div className="space-y-2">
                <Label>Visibilité</Label>
                <VisibilityPicker
                  value={form.visibility}
                  onChange={(v) => setForm({ ...form, visibility: v })}
                  companyId={companyId}
                  companyEnforcedAvailable={canEnforce}
                  testId="hooks-form-visibility"
                />
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="font-medium">Activé</Label>
                  <p className="text-xs text-muted-foreground">
                    Désactivé : la config reste visible mais le hook n'est pas
                    exécuté.
                  </p>
                </div>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm({ ...form, enabled: v })}
                  data-testid="hooks-form-enabled"
                />
              </div>

              {canEnforce && (
                <div className="rounded-md border border-amber-500/50 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">
                        Company-enforced{" "}
                        <Badge variant="outline" className="ml-1 text-xs">
                          :enforce
                        </Badge>
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Imposé à TOUS les workflows de la company, même non
                        listés dans <code>workflow.json</code>.
                      </p>
                    </div>
                    <Switch
                      checked={form.enforced}
                      onCheckedChange={(v) =>
                        setForm({
                          ...form,
                          enforced: v,
                          enforcedPhases: v ? form.enforcedPhases : [],
                        })
                      }
                      data-testid="hooks-form-enforced"
                    />
                  </div>

                  {form.enforced && (
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        Phases enforced
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {PHASES.map((p) => {
                          const checked = form.enforcedPhases.includes(p);
                          return (
                            <Badge
                              key={p}
                              variant={checked ? "default" : "outline"}
                              className="cursor-pointer"
                              data-testid={`hooks-form-phase-${p}`}
                              onClick={() =>
                                setForm({
                                  ...form,
                                  enforcedPhases: checked
                                    ? form.enforcedPhases.filter(
                                        (x) => x !== p,
                                      )
                                    : [...form.enforcedPhases, p],
                                })
                              }
                            >
                              {p}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!isCreating && (
                <ExecutionsTable executions={executions?.executions ?? []} />
              )}
            </>
          )}
        </div>

        {submitError && (
          <p className="text-sm text-destructive px-1" role="alert">
            {submitError}
          </p>
        )}

        <SheetFooter className="flex flex-row justify-between gap-2">
          {!isCreating && editingId && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="hooks-form-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Supprimer
            </Button>
          )}

          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !canSubmit ||
                createMutation.isPending ||
                updateMutation.isPending
              }
              data-testid="hooks-form-submit"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              {isCreating ? "Créer" : "Enregistrer"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ExecutionsTable({ executions }: { executions: HookExecution[] }) {
  if (executions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Aucune exécution récente.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        Exécutions récentes
      </Label>
      <div className="rounded-md border divide-y text-xs">
        {executions.slice(0, 20).map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between px-3 py-2"
            data-testid={`hooks-execution-${e.id}`}
          >
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  e.status === "success"
                    ? "default"
                    : e.status === "failed" || e.status === "timeout"
                      ? "destructive"
                      : "secondary"
                }
              >
                {e.status}
              </Badge>
              <span className="font-mono">{e.phase}</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>{e.durationMs ? `${e.durationMs}ms` : "—"}</span>
              <span>{new Date(e.createdAt).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
