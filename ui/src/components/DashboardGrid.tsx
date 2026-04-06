import { Suspense, useState } from "react";
import type { DashboardWidget, UserWidget } from "@mnm/shared";
import { WIDGET_REGISTRY } from "../lib/widget-registry";
import { cn } from "../lib/utils";
import { ContentRenderer } from "./blocks/ContentRenderer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, Sparkles, Trash2, Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const SPAN_CLASSES: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-1 md:col-span-2",
  3: "col-span-1 md:col-span-3",
  4: "col-span-1 md:col-span-4",
};

function WidgetSkeleton() {
  return <div className="animate-pulse bg-muted rounded-lg min-h-[120px]" />;
}

interface DashboardGridProps {
  companyId: string;
  widgets: DashboardWidget[];
  customWidgets?: UserWidget[];
  onAddWidget?: () => void;
  onDeleteWidget?: (widgetId: string) => void;
  onResizeWidget?: (widgetId: string, span: number) => void;
}

function CustomWidgetCard({
  widget,
  onDelete,
  onResize,
}: {
  widget: UserWidget;
  onDelete?: (widgetId: string) => void;
  onResize?: (widgetId: string, span: number) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <span className="text-sm font-medium text-foreground truncate">{widget.title}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Maximize2 className="mr-2 h-3.5 w-3.5" />
                  Resize
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {[1, 2, 3, 4].map((s) => (
                    <DropdownMenuItem
                      key={s}
                      onClick={() => onResize?.(widget.id, s)}
                      className={widget.span === s ? "font-semibold" : ""}
                    >
                      Span {s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="p-4">
          <ContentRenderer blocks={widget.blocks} body={widget.description} className="text-sm" />
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete widget</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{widget.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete?.(widget.id);
                setConfirmDelete(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DashboardGrid({
  companyId,
  widgets,
  customWidgets,
  onAddWidget,
  onDeleteWidget,
  onResizeWidget,
}: DashboardGridProps) {
  return (
    <div className="space-y-6">
      {/* Predefined widgets from View Preset layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {widgets.map((widget, i) => {
          const def = WIDGET_REGISTRY[widget.type];
          if (!def) return null;
          const Widget = def.component;
          const span = widget.span ?? def.defaultSpan;
          return (
            <div key={`${widget.type}-${i}`} className={cn(SPAN_CLASSES[span] ?? "col-span-1")}>
              <Suspense fallback={<WidgetSkeleton />}>
                <Widget companyId={companyId} span={span} props={widget.props} />
              </Suspense>
            </div>
          );
        })}
      </div>

      {/* Custom widgets section */}
      {customWidgets !== undefined && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              My Widgets
            </h3>
            {onAddWidget && (
              <Button variant="outline" size="sm" onClick={onAddWidget}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Widget
              </Button>
            )}
          </div>

          {customWidgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No custom widgets yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Ask CAO to create a personalized widget for your dashboard.
              </p>
              {onAddWidget && (
                <Button variant="outline" size="sm" className="mt-4" onClick={onAddWidget}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add your first widget
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {customWidgets.map((widget) => (
                <div key={widget.id} className={cn(SPAN_CLASSES[widget.span] ?? SPAN_CLASSES[2])}>
                  <CustomWidgetCard
                    widget={widget}
                    onDelete={onDeleteWidget}
                    onResize={onResizeWidget}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
