import { ArrowRight, CheckCircle2, Shield, Zap } from "lucide-react";
import type { StageDef } from "./StageEditorCard";

interface WorkflowEditorPreviewProps {
  stages: StageDef[];
  templateName: string;
}

export function WorkflowEditorPreview({ stages, templateName }: WorkflowEditorPreviewProps) {
  if (stages.length === 0) {
    return (
      <div data-testid="orch-s05-preview-panel" className="rounded-lg border border-border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">No stages to preview. Add stages to see the pipeline.</p>
      </div>
    );
  }

  return (
    <div data-testid="orch-s05-preview-panel" className="rounded-lg border border-border bg-muted/30 p-6">
      <h3 className="text-sm font-semibold mb-4">
        Pipeline Preview: {templateName || "Untitled Template"}
      </h3>

      <div className="flex items-start gap-2 overflow-x-auto pb-2">
        {stages.map((stage, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <div
              data-testid={`orch-s05-preview-stage-${i}`}
              className="rounded-lg border border-border bg-card p-3 min-w-[160px] max-w-[200px]"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-medium text-muted-foreground">
                  Stage {i + 1}
                </span>
                {stage.autoTransition && (
                  <span aria-label="Auto Transition"><Zap className="h-3 w-3 text-blue-500" /></span>
                )}
                {stage.hitlRequired && (
                  <span aria-label="HITL Required"><Shield className="h-3 w-3 text-amber-500" /></span>
                )}
              </div>
              <p className="text-sm font-medium truncate">{stage.name}</p>
              {stage.agentRole && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Role: {stage.agentRole}
                </p>
              )}
              {stage.description && (
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                  {stage.description}
                </p>
              )}
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {(stage.requiredFiles ?? []).length > 0 && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-500">
                    {stage.requiredFiles!.length} file{stage.requiredFiles!.length !== 1 ? "s" : ""}
                  </span>
                )}
                {(stage.prePrompts ?? []).length > 0 && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-500">
                    {stage.prePrompts!.length} prompt{stage.prePrompts!.length !== 1 ? "s" : ""}
                  </span>
                )}
                {(stage.acceptanceCriteria ?? []).length > 0 && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/10 text-green-500">
                    <CheckCircle2 className="h-2.5 w-2.5 inline mr-0.5" />
                    {stage.acceptanceCriteria!.length} AC
                  </span>
                )}
              </div>
            </div>
            {i < stages.length - 1 && (
              <ArrowRight
                data-testid={`orch-s05-preview-arrow-${i}`}
                className="h-4 w-4 text-muted-foreground shrink-0"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
