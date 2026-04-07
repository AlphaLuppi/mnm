import { useState, type ReactNode } from "react";
import { cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  Trash2,
  AlertCircle,
} from "lucide-react";

export interface WidgetCardProps {
  title: string;
  widgetId: string;
  isDragging?: boolean;
  isResizing?: boolean;
  isLoading?: boolean;
  error?: string | null;
  resizeLabel?: string;
  children: ReactNode;
  onDelete?: (widgetId: string) => void;
  /** Hide drag/resize for mobile */
  disableDrag?: boolean;
  disableResize?: boolean;
  /** Alt+Arrow: move widget by dx/dy grid units */
  onKeyboardMove?: (widgetId: string, dx: number, dy: number) => void;
  /** Alt+Shift+Arrow: resize widget by dw/dh grid units */
  onKeyboardResize?: (widgetId: string, dw: number, dh: number) => void;
  /**
   * "card" (default) — full Card wrapper with header/title/content (for custom widgets).
   * "overlay" — transparent wrapper with just drag handle + actions overlay (for preset widgets that already have their own card styling).
   */
  variant?: "card" | "overlay";
}

export function WidgetCard({
  title,
  widgetId,
  isDragging,
  isResizing,
  isLoading,
  error,
  resizeLabel,
  children,
  onDelete,
  disableDrag,
  disableResize,
  onKeyboardMove,
  onKeyboardResize,
  variant = "card",
}: WidgetCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!e.altKey) return;
    const arrow = e.key;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(arrow)) return;

    e.preventDefault();

    if (e.shiftKey && onKeyboardResize && !disableResize) {
      const dw = arrow === "ArrowRight" ? 1 : arrow === "ArrowLeft" ? -1 : 0;
      const dh = arrow === "ArrowDown" ? 1 : arrow === "ArrowUp" ? -1 : 0;
      if (dw !== 0 || dh !== 0) onKeyboardResize(widgetId, dw, dh);
    } else if (onKeyboardMove && !disableDrag) {
      const dx = arrow === "ArrowRight" ? 1 : arrow === "ArrowLeft" ? -1 : 0;
      const dy = arrow === "ArrowDown" ? 1 : arrow === "ArrowUp" ? -1 : 0;
      if (dx !== 0 || dy !== 0) onKeyboardMove(widgetId, dx, dy);
    }
  }

  /* ── Actions dropdown (shared between both variants) ── */
  const actionsMenu = (
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
  );

  /* ── Delete confirmation dialog (shared) ── */
  const deleteDialog = (
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
  );

  /* ── Overlay variant: transparent wrapper for preset widgets that have their own card styling ── */
  if (variant === "overlay") {
    return (
      <>
        <div
          onKeyDown={handleKeyDown}
          className={cn(
            "group/widget relative h-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg transition-all duration-150 bg-card border border-border shadow-sm",
            isDragging
              ? "shadow-xl opacity-80 z-50 rotate-1"
              : isResizing
                ? "border-primary/50 shadow-md"
                : "hover:shadow-md",
          )}
          tabIndex={0}
          role="article"
          aria-label={`Widget: ${title}`}
          aria-roledescription="dashboard widget"
        >
          {/* Drag handle overlay (top-left) */}
          {!disableDrag && (
            <button
              type="button"
              className="widget-drag-handle absolute top-1 left-1 z-20 opacity-0 group-hover/widget:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 cursor-grab active:cursor-grabbing bg-background/80 rounded p-0.5"
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

          {/* Actions menu overlay (top-right) */}
          <div className="absolute top-1 right-1 z-20 opacity-0 group-hover/widget:opacity-100 group-focus-within/widget:opacity-100 transition-opacity duration-150">
            {actionsMenu}
          </div>

          {/* Content: rendered directly, no extra padding/wrapper */}
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-xs text-destructive p-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <WidgetErrorBoundary>{children}</WidgetErrorBoundary>
          )}

          {/* Resize dimension overlay */}
          {isResizing && resizeLabel && (
            <div className="absolute bottom-2 right-8 text-xs font-medium bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md z-10">
              {resizeLabel}
            </div>
          )}
        </div>

        {deleteDialog}
      </>
    );
  }

  /* ── Card variant (default): full Card wrapper for custom widgets ── */
  return (
    <>
      <Card
        onKeyDown={handleKeyDown}
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
            {actionsMenu}
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
            <WidgetErrorBoundary>{children}</WidgetErrorBoundary>
          )}
        </CardContent>

        {/* Resize dimension overlay */}
        {isResizing && resizeLabel && (
          <div className="absolute bottom-2 right-8 text-xs font-medium bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md z-10">
            {resizeLabel}
          </div>
        )}
      </Card>

      {deleteDialog}
    </>
  );
}
