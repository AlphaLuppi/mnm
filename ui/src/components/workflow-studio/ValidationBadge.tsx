/**
 * ValidationBadge (U14.5) — live JSON + schema validation indicator for the
 * Workflow Studio's active file.
 *
 * We only validate `workflow.json` (the canonical file). Other files are
 * skipped by returning null — TS gates are validated at commit time by the
 * backend's isolated-vm probe, not here.
 *
 * Click the badge to open a Sheet drawer listing every issue (schema path +
 * message) or the raw JSON parse error. This replaces the old "errors are
 * stamped on the editor side" UX with something compact that doesn't steal
 * Monaco space.
 */
import { useMemo, useState } from "react";
import { workflowDefinitionSchema } from "@mnm/governed-workflows";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { CheckCircle2, CircleAlert } from "lucide-react";

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult =
  | { kind: "parse-error"; parseMessage: string }
  | { kind: "schema-error"; issues: ValidationIssue[] }
  | { kind: "ok" };

/**
 * Pure helper — parse + schema-validate a raw workflow.json string. Kept
 * outside the component so unit tests can exercise every branch without a
 * DOM.
 */
export function validateWorkflowJson(raw: string | undefined): ValidationResult {
  if (raw === undefined || raw === null) {
    return { kind: "parse-error", parseMessage: "Aucun contenu à valider." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: "parse-error", parseMessage: message };
  }
  const result = workflowDefinitionSchema.safeParse(parsed);
  if (result.success) return { kind: "ok" };
  const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
  return { kind: "schema-error", issues };
}

export interface ValidationBadgeProps {
  activePath: string | null;
  activeContent: string | undefined;
}

export function ValidationBadge(props: ValidationBadgeProps) {
  const [open, setOpen] = useState(false);

  const result = useMemo<ValidationResult | null>(() => {
    if (props.activePath !== "workflow.json") return null;
    return validateWorkflowJson(props.activeContent);
  }, [props.activePath, props.activeContent]);

  if (!result) return null;

  const isOk = result.kind === "ok";
  const label =
    result.kind === "ok"
      ? "JSON valide"
      : result.kind === "parse-error"
        ? "JSON invalide"
        : `${result.issues.length} erreur${result.issues.length > 1 ? "s" : ""}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 focus:outline-none"
        aria-label={`Statut de validation: ${label}`}
      >
        <Badge
          variant={isOk ? "default" : "destructive"}
          className="shadow-md cursor-pointer select-none"
        >
          {isOk ? (
            <CheckCircle2 className="h-3 w-3 mr-1" />
          ) : (
            <CircleAlert className="h-3 w-3 mr-1" />
          )}
          {label}
        </Badge>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>
              {isOk ? "Validation OK" : "Problèmes de validation"}
            </SheetTitle>
            <SheetDescription>
              Workflow JSON — contrôle contre le schéma zod{" "}
              <span className="font-mono">workflowDefinitionSchema</span>.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4 text-sm overflow-y-auto">
            {result.kind === "ok" && (
              <div className="rounded border border-emerald-400/30 bg-emerald-500/10 text-emerald-700 p-3">
                Tout bon — le fichier respecte le schéma.
              </div>
            )}
            {result.kind === "parse-error" && (
              <div className="rounded border border-destructive/40 bg-destructive/10 p-3 space-y-1">
                <div className="font-medium text-destructive">
                  Erreur de syntaxe JSON
                </div>
                <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                  {result.parseMessage}
                </pre>
              </div>
            )}
            {result.kind === "schema-error" && (
              <ul className="space-y-2">
                {result.issues.map((issue, i) => (
                  <li
                    key={i}
                    className="rounded border border-destructive/40 bg-destructive/10 p-2"
                  >
                    <div className="font-mono text-xs text-destructive">
                      {issue.path}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {issue.message}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
