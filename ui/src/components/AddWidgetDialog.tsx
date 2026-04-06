import { useState } from "react";
import type { CreateUserWidget, UserWidget } from "@mnm/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ContentRenderer } from "./blocks/ContentRenderer";
import { WIDGET_REGISTRY } from "../lib/widget-registry";
import { cn } from "../lib/utils";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  LayoutGrid,
  Package,
  PieChart,
  Sparkles,
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
  onCreateWidget: (data: CreateUserWidget) => Promise<void>;
  onGenerateWidget?: (prompt: string) => Promise<UserWidget>;
  /** Widget IDs already placed in the grid */
  placedWidgetIds?: Set<string>;
  /** Callback to add a preset widget by type */
  onAddPresetWidget?: (type: string, span: number) => void;
}

const SUGGESTION_CHIPS = [
  "Issue burn-down",
  "Agent cost breakdown",
  "Sprint velocity",
];

export function AddWidgetDialog({
  open,
  onOpenChange,
  onCreateWidget,
  onGenerateWidget,
  placedWidgetIds,
  onAddPresetWidget,
}: AddWidgetDialogProps) {
  const [caoPrompt, setCaoPrompt] = useState("");
  const [caoSize, setCaoSize] = useState(2);
  const [creating, setCreating] = useState(false);
  const [caoError, setCaoError] = useState<string | null>(null);
  const [previewWidget, setPreviewWidget] = useState<UserWidget | null>(null);

  function handleClose() {
    setCaoPrompt("");
    setCaoSize(2);
    setCaoError(null);
    setCreating(false);
    setPreviewWidget(null);
    onOpenChange(false);
  }

  async function handleAddPreset(type: string, span: number) {
    if (onAddPresetWidget) {
      onAddPresetWidget(type, span);
      handleClose();
    }
  }

  async function handleCaoSubmit() {
    if (!caoPrompt.trim()) return;
    setCreating(true);
    setCaoError(null);
    setPreviewWidget(null);
    try {
      if (onGenerateWidget) {
        const widget = await onGenerateWidget(caoPrompt.trim());
        setPreviewWidget(widget);
      } else {
        await onCreateWidget({
          title: caoPrompt.trim().slice(0, 60),
          description: caoPrompt.trim(),
          blocks: {
            schemaVersion: 1,
            blocks: [{ type: "markdown", content: `*Pending CAO generation...*\n\nPrompt: ${caoPrompt.trim()}` }],
          },
          span: caoSize,
        });
        handleClose();
      }
    } catch (err) {
      setCaoError(err instanceof Error ? err.message : "Widget generation failed. Try rephrasing your request.");
    } finally {
      setCreating(false);
    }
  }

  function handleAddFromPreview() {
    handleClose();
  }

  function handleRegenerate() {
    setPreviewWidget(null);
    handleCaoSubmit();
  }

  const registryEntries = Object.entries(WIDGET_REGISTRY);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="gallery">
          <TabsList>
            <TabsTrigger value="gallery" aria-label="Browse preset widgets">
              Gallery
            </TabsTrigger>
            <TabsTrigger value="create" aria-label="Create a custom widget with AI">
              Create with AI
            </TabsTrigger>
          </TabsList>

          {/* Gallery Tab */}
          <TabsContent value="gallery" className="mt-4">
            <ScrollArea className="max-h-[400px]">
              <div className="grid grid-cols-2 gap-3 pr-1">
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
                    >
                      <IconComponent className="h-5 w-5 text-muted-foreground" />
                      <div className="text-sm font-medium text-foreground">{def.label}</div>
                      {def.description && (
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {def.description}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground/60">
                        {def.defaultSpan === 4 ? "4 columns" : `${def.defaultSpan} column${def.defaultSpan > 1 ? "s" : ""}`}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={isPlaced || creating}
                        onClick={() => handleAddPreset(type, def.defaultSpan)}
                      >
                        {isPlaced ? "Already added" : "Add"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Create with AI Tab */}
          <TabsContent value="create" className="mt-4 space-y-4">
            {previewWidget ? (
              <div className="space-y-4">
                <p className="text-sm font-medium text-foreground">Preview</p>
                <div className="rounded-lg border border-border p-4 max-h-[300px] overflow-auto">
                  <ContentRenderer blocks={previewWidget.blocks} body={previewWidget.description} className="text-sm" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={handleRegenerate}>
                    Regenerate
                  </Button>
                  <Button size="sm" onClick={handleAddFromPreview}>
                    Add to Dashboard
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Describe the widget you want CAO to create:
                  </p>
                  <Textarea
                    rows={3}
                    placeholder="e.g., Show me a burn-down chart for issues tagged 'backend' over the last 30 days..."
                    value={caoPrompt}
                    onChange={(e) => setCaoPrompt(e.target.value)}
                  />
                  {caoError && (
                    <p className="text-xs text-destructive">{caoError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Suggested prompts:</p>
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
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Size:</p>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map((s) => (
                      <Button
                        key={s}
                        variant={caoSize === s ? "default" : "outline"}
                        size="sm"
                        className="w-10"
                        onClick={() => setCaoSize(s)}
                        aria-label={`Set widget width to ${s} column${s > 1 ? "s" : ""}`}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={!caoPrompt.trim() || creating}
                    onClick={handleCaoSubmit}
                  >
                    {creating ? (
                      <>
                        <Sparkles className="mr-1.5 h-3.5 w-3.5 animate-pulse" />
                        CAO is generating...
                      </>
                    ) : (
                      "Generate Widget"
                    )}
                  </Button>
                </div>

                {creating && (
                  <div className="rounded-lg border border-dashed border-border p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
