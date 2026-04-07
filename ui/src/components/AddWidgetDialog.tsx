import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WIDGET_REGISTRY } from "../lib/widget-registry";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Crown,
  LayoutGrid,
  Package,
  PieChart,
  TrendingUp,
  Users,
} from "lucide-react";

const WIDGET_ICON_MAP: Record<string, React.ElementType> = {
  "kpi-bar": LayoutGrid,
  "kpi-enterprise": LayoutGrid,
  "run-activity": Activity,
  "priority-chart": BarChart3,
  "status-chart": PieChart,
  "success-rate": TrendingUp,
  "active-agents": Users,
  "recent-issues": AlertTriangle,
  "recent-activity": Clock,
  "timeline": Clock,
  "breakdown": BarChart3,
  "chat-activity": Activity,
  "my-folders": Package,
  "my-issues": AlertTriangle,
  "team-activity": Users,
  "cost-overview": TrendingUp,
  "health-summary": Activity,
};

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Widget IDs already placed in the grid */
  placedWidgetIds?: Set<string>;
  /** Callback to add a preset widget by type */
  onAddPresetWidget?: (type: string) => void;
}

const SUGGESTION_CHIPS = [
  "Issue burn-down",
  "Agent cost breakdown",
  "Sprint velocity",
];

export function AddWidgetDialog({
  open,
  onOpenChange,
  placedWidgetIds,
  onAddPresetWidget,
}: AddWidgetDialogProps) {
  const [caoPrompt, setCaoPrompt] = useState("");
  const { openNewIssue } = useDialog();
  const { selectedCompanyId } = useCompany();

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && open,
  });

  const caoAgent = (agents ?? []).find((a) => a.name === "CAO");

  function handleClose() {
    setCaoPrompt("");
    onOpenChange(false);
  }

  function handleAddPreset(type: string) {
    if (onAddPresetWidget) {
      onAddPresetWidget(type);
      handleClose();
    }
  }

  function handleAskCao() {
    if (!caoPrompt.trim()) return;
    handleClose();
    openNewIssue({
      assigneeAgentId: caoAgent?.id,
      title: "Create a dashboard widget",
      description: caoPrompt.trim(),
    });
  }

  const registryEntries = Object.entries(WIDGET_REGISTRY);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md p-0 gap-0 overflow-hidden"
      >
        {/* Header — same as NewAgentDialog */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <span className="text-sm text-muted-foreground">Add a widget</span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            onClick={() => handleClose()}
          >
            <span className="text-lg leading-none">&times;</span>
          </Button>
        </div>

        {/* Preset gallery */}
        <ScrollArea className="max-h-[300px] px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            {registryEntries.map(([type, def]) => {
              const isPlaced = placedWidgetIds?.has(`preset:${type}`);
              const IconComponent = WIDGET_ICON_MAP[type] ?? Package;
              return (
                <div
                  key={type}
                  className={cn(
                    "rounded-lg border border-border p-4 transition-all space-y-2",
                    isPlaced
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:border-primary/50 hover:bg-accent/30 cursor-pointer",
                  )}
                  onClick={() => !isPlaced && handleAddPreset(type)}
                >
                  <IconComponent className="h-5 w-5 text-muted-foreground" />
                  <div className="text-sm font-medium text-foreground">{def.label}</div>
                  {def.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {def.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* CAO section */}
        <div className="border-t border-border px-6 py-4 space-y-3">
          <div className="flex gap-2">
            <Textarea
              rows={1}
              className="min-h-9 resize-none"
              placeholder="Or describe a custom widget..."
              value={caoPrompt}
              onChange={(e) => setCaoPrompt(e.target.value)}
            />
            <Button
              size="sm"
              onClick={handleAskCao}
              disabled={!caoAgent || !caoPrompt.trim()}
            >
              <Crown className="h-4 w-4 mr-1.5" />
              Ask CAO
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTION_CHIPS.map((chip) => (
              <Button
                key={chip}
                variant="outline"
                size="sm"
                className="rounded-full text-xs"
                onClick={() => setCaoPrompt(chip)}
              >
                {chip}
              </Button>
            ))}
          </div>
          {!caoAgent && (
            <p className="text-xs text-muted-foreground">
              CAO agent not found. Complete onboarding first.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
