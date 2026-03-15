import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  ChevronRight,
  ChevronDown as ExpandIcon,
  Plus,
  X,
} from "lucide-react";

export interface RequiredFileDef {
  path: string;
  description?: string;
}

export interface StageDef {
  order: number;
  name: string;
  description?: string;
  agentRole?: string;
  autoTransition: boolean;
  acceptanceCriteria?: string[];
  requiredFiles?: RequiredFileDef[];
  prePrompts?: string[];
  expectedOutputs?: string[];
  hitlRequired?: boolean;
  hitlRoles?: string[];
}

const AGENT_ROLES = ["pm", "architect", "dev", "qa", "reviewer"] as const;
const HITL_ROLE_OPTIONS = ["admin", "manager", "contributor"] as const;

interface StageEditorCardProps {
  stage: StageDef;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isOnly: boolean;
  onChange: (updated: StageDef) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export function StageEditorCard({
  stage,
  index,
  isFirst,
  isLast,
  isOnly,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: StageEditorCardProps) {
  const [expanded, setExpanded] = useState(false);

  function update(partial: Partial<StageDef>) {
    onChange({ ...stage, ...partial });
  }

  function addRequiredFile() {
    const files = [...(stage.requiredFiles ?? []), { path: "", description: "" }];
    update({ requiredFiles: files });
  }

  function removeRequiredFile(i: number) {
    const files = (stage.requiredFiles ?? []).filter((_, idx) => idx !== i);
    update({ requiredFiles: files });
  }

  function updateRequiredFile(i: number, field: "path" | "description", value: string) {
    const files = [...(stage.requiredFiles ?? [])];
    files[i] = { ...files[i], [field]: value };
    update({ requiredFiles: files });
  }

  function addPrePrompt() {
    const prompts = [...(stage.prePrompts ?? []), ""];
    update({ prePrompts: prompts });
  }

  function removePrePrompt(i: number) {
    const prompts = (stage.prePrompts ?? []).filter((_, idx) => idx !== i);
    update({ prePrompts: prompts });
  }

  function updatePrePrompt(i: number, value: string) {
    const prompts = [...(stage.prePrompts ?? [])];
    prompts[i] = value;
    update({ prePrompts: prompts });
  }

  function addAcceptanceCriteria() {
    const criteria = [...(stage.acceptanceCriteria ?? []), ""];
    update({ acceptanceCriteria: criteria });
  }

  function removeAcceptanceCriteria(i: number) {
    const criteria = (stage.acceptanceCriteria ?? []).filter((_, idx) => idx !== i);
    update({ acceptanceCriteria: criteria });
  }

  function updateAcceptanceCriteria(i: number, value: string) {
    const criteria = [...(stage.acceptanceCriteria ?? [])];
    criteria[i] = value;
    update({ acceptanceCriteria: criteria });
  }

  function toggleHitlRole(role: string) {
    const roles = stage.hitlRoles ?? [];
    const next = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
    update({ hitlRoles: next });
  }

  return (
    <div
      data-testid={`orch-s05-stage-card-${index}`}
      className="rounded-lg border border-border bg-card p-4"
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        <button
          data-testid={`orch-s05-stage-expand-${index}`}
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? (
            <ExpandIcon className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <span className="text-xs font-medium text-muted-foreground w-6">
          #{index + 1}
        </span>

        <input
          data-testid={`orch-s05-stage-name-${index}`}
          type="text"
          value={stage.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Stage name"
          className="flex-1 text-sm font-medium bg-transparent border-b border-transparent hover:border-border focus:border-ring focus:outline-none px-1 py-0.5 transition-colors"
        />

        <div className="flex items-center gap-1 shrink-0">
          <Button
            data-testid={`orch-s05-stage-move-up-${index}`}
            variant="ghost"
            size="icon-sm"
            onClick={onMoveUp}
            disabled={isFirst}
            className="h-6 w-6"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            data-testid={`orch-s05-stage-move-down-${index}`}
            variant="ghost"
            size="icon-sm"
            onClick={onMoveDown}
            disabled={isLast}
            className="h-6 w-6"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          {!isOnly && (
            <Button
              data-testid={`orch-s05-stage-delete-${index}`}
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              className="h-6 w-6 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="mt-4 space-y-4 pl-8">
          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              data-testid={`orch-s05-stage-description-${index}`}
              value={stage.description ?? ""}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Stage description..."
              rows={2}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Agent Role */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Agent Role</label>
            <select
              data-testid={`orch-s05-stage-role-${index}`}
              value={stage.agentRole ?? ""}
              onChange={(e) => update({ agentRole: e.target.value || undefined })}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">No role assigned</option>
              {AGENT_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Auto Transition */}
          <div className="flex items-center gap-2">
            <input
              data-testid={`orch-s05-stage-auto-transition-${index}`}
              type="checkbox"
              checked={stage.autoTransition}
              onChange={(e) => update({ autoTransition: e.target.checked })}
              className="rounded border-border"
            />
            <label className="text-xs font-medium text-muted-foreground">
              Auto Transition
            </label>
          </div>

          {/* HITL */}
          <div>
            <div className="flex items-center gap-2">
              <input
                data-testid={`orch-s05-stage-hitl-toggle-${index}`}
                type="checkbox"
                checked={stage.hitlRequired ?? false}
                onChange={(e) =>
                  update({ hitlRequired: e.target.checked, hitlRoles: e.target.checked ? stage.hitlRoles ?? [] : [] })
                }
                className="rounded border-border"
              />
              <label className="text-xs font-medium text-muted-foreground">
                Human Validation Required (HITL)
              </label>
            </div>
            {stage.hitlRequired && (
              <div
                data-testid={`orch-s05-stage-hitl-roles-${index}`}
                className="mt-2 flex flex-wrap gap-2 pl-4"
              >
                {HITL_ROLE_OPTIONS.map((role) => (
                  <label key={role} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={(stage.hitlRoles ?? []).includes(role)}
                      onChange={() => toggleHitlRole(role)}
                      className="rounded border-border"
                    />
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Required Files */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Required Files</label>
              <Button
                data-testid={`orch-s05-stage-add-file-${index}`}
                variant="ghost"
                size="sm"
                onClick={addRequiredFile}
                className="h-6 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add File
              </Button>
            </div>
            <div data-testid={`orch-s05-stage-required-files-${index}`} className="mt-1 space-y-2">
              {(stage.requiredFiles ?? []).map((file, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={file.path}
                    onChange={(e) => updateRequiredFile(i, "path", e.target.value)}
                    placeholder="File path"
                    className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={file.description ?? ""}
                    onChange={(e) => updateRequiredFile(i, "description", e.target.value)}
                    placeholder="Description"
                    className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button onClick={() => removeRequiredFile(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pre-Prompts */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Pre-Prompts</label>
              <Button
                data-testid={`orch-s05-stage-add-preprompt-${index}`}
                variant="ghost"
                size="sm"
                onClick={addPrePrompt}
                className="h-6 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Pre-Prompt
              </Button>
            </div>
            <div data-testid={`orch-s05-stage-preprompts-${index}`} className="mt-1 space-y-2">
              {(stage.prePrompts ?? []).map((prompt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <textarea
                    value={prompt}
                    onChange={(e) => updatePrePrompt(i, e.target.value)}
                    placeholder="Pre-prompt text..."
                    rows={2}
                    className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                  <button onClick={() => removePrePrompt(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Acceptance Criteria */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Acceptance Criteria</label>
              <Button
                data-testid={`orch-s05-stage-add-acceptance-${index}`}
                variant="ghost"
                size="sm"
                onClick={addAcceptanceCriteria}
                className="h-6 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Criteria
              </Button>
            </div>
            <div data-testid={`orch-s05-stage-acceptance-${index}`} className="mt-1 space-y-2">
              {(stage.acceptanceCriteria ?? []).map((criterion, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={criterion}
                    onChange={(e) => updateAcceptanceCriteria(i, e.target.value)}
                    placeholder="Acceptance criterion..."
                    className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button onClick={() => removeAcceptanceCriteria(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
