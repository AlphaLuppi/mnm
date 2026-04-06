import { useState, type ReactNode } from "react";
import { cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GripVertical,
  MoreHorizontal,
  Wrench,
  Maximize2,
  Trash2,
  AlertCircle,
} from "lucide-react";

export interface WidgetCardProps {
  title: string;
  widgetId: string;
  currentSpan: number;
  isDragging?: boolean;
  isResizing?: boolean;
  isLoading?: boolean;
  error?: string | null;
  resizeLabel?: string;
  children: ReactNode;
  onResize?: (widgetId: string, span: number) => void;
  onDelete?: (widgetId: string) => void;
  /** Hide drag/resize for mobile */
  disableDrag?: boolean;
  disableResize?: boolean;
}

export function WidgetCard({
  title,
  widgetId,
  currentSpan,
  isDragging,
  isResizing,
  isLoading,
  error,
  resizeLabel,
  children,
  onResize,
  onDelete,
  disableDrag,
  disableResize,
}: WidgetCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <Card
        className={cn(
          "group/widget relative rounded-lg overflow-hidden transition-all duration-150 h-full flex flex-col gap-0 py-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isDragging
            ? "shadow-xl opacity-80 z-50 rotate-1"
            : isResizing
              ? "border-primary/50 shadow-md"
              : "shadow-sm hover:shadow-md",
        )}
        tabIndex={0}
        role="article"
        aria-label={`Widget: ${title}`}
        aria-roledescription="dashboard widget"
      >
        {/* Header */}
        <CardHeader className="flex-row items-center gap-2 px-3 py-2.5 border-b border-border/50 space-y-0">
          {/* Drag handle */}
          {!disableDrag && (
            <button
              type="button"
              className="widget-drag-handle opacity-0 group-hover/widget:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 cursor-grab active:cursor-grabbing"
              aria-label={`Drag to reorder ${title}`}
              aria-roledescription="drag handle"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                }
              }}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/50" />
            </button>
          )}

          {/* Title */}
          <CardTitle className="text-sm font-medium text-foreground truncate flex-1">
            {title}
          </CardTitle>

          {/* Actions menu */}
          <div className="opacity-0 group-hover/widget:opacity-100 group-focus-within/widget:opacity-100 transition-opacity duration-150">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label={`Widget actions for ${title}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>
                  <Wrench className="mr-2 h-3.5 w-3.5" />
                  Configure
                </DropdownMenuItem>
                {!disableResize && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger aria-label={`Resize widget ${title}`}>
                      <Maximize2 className="mr-2 h-3.5 w-3.5" />
                      Resize
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {[1, 2, 3, 4].map((s) => (
                        <DropdownMenuItem
                          key={s}
                          onClick={() => onResize?.(widgetId, s)}
                          className={currentSpan === s ? "font-semibold" : ""}
                        >
                          Span {s}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setConfirmDelete(true)}
                  aria-label={`Delete widget ${title}`}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="p-4 overflow-hidden flex-1">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            children
          )}
        </CardContent>

        {/* Resize dimension overlay */}
        {isResizing && resizeLabel && (
          <div className="absolute bottom-2 right-8 text-xs font-medium bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md z-10">
            {resizeLabel}
          </div>
        )}
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete widget</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete?.(widgetId);
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
