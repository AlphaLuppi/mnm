import { useState } from "react";
import type { CreateUserWidget } from "@mnm/shared";
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
import { WIDGET_REGISTRY } from "../lib/widget-registry";
import { Package, Sparkles } from "lucide-react";

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateWidget: (data: CreateUserWidget) => Promise<void>;
  onGenerateWidget?: (prompt: string) => Promise<void>;
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

  function handleClose() {
    setCaoPrompt("");
    setCaoSize(2);
    setCaoError(null);
    setCreating(false);
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
    try {
      if (onGenerateWidget) {
        await onGenerateWidget(caoPrompt.trim());
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
      }
      handleClose();
    } catch (err) {
      setCaoError(err instanceof Error ? err.message : "Widget generation failed. Try rephrasing your request.");
    } finally {
      setCreating(false);
    }
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
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
              {registryEntries.map(([type, def]) => {
                const isPlaced = placedWidgetIds?.has(`preset:${type}`);
                return (
                  <div
                    key={type}
                    className={`rounded-lg border border-border p-4 transition-all space-y-2 ${
                      isPlaced
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:border-primary/50 hover:bg-accent/30 cursor-pointer"
                    }`}
                  >
                    <Package className="h-5 w-5 text-muted-foreground" />
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
          </TabsContent>

          {/* Create with AI Tab */}
          <TabsContent value="create" className="mt-4 space-y-4">
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
