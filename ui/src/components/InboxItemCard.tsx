import { useRef, useState } from "react";
import type { InboxItem } from "@mnm/shared";
import { ContentRenderer } from "./blocks/ContentRenderer";
import { useBlockActions } from "../hooks/useBlockActions";
import { StatusBadge } from "./StatusBadge";
import { Identity } from "./Identity";
import { Button } from "@/components/ui/button";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";
import { X, Check } from "lucide-react";

const PRIORITY_BAR_CLASSES: Record<string, string> = {
  low: "bg-muted-foreground/20",
  normal: "bg-transparent",
  high: "bg-warning",
  urgent: "bg-error animate-pulse",
};

const STATUS_CARD_CLASSES: Record<string, string> = {
  unread: "border-l-2 border-l-primary bg-primary/[0.02]",
  read: "opacity-80",
  actioned: "border-l-2 border-l-success/50 bg-success/[0.02]",
  dismissed: "opacity-50",
  expired: "opacity-50",
};

const CATEGORY_VARIANT: Record<string, "success" | "warning" | "error" | "info" | "default"> = {
  notification: "info",
  approval: "warning",
  alert: "error",
  failed_run: "error",
  digest: "default",
  action_required: "warning",
};

const CONTENT_MAX_HEIGHT = 200;

interface InboxItemCardProps {
  item: InboxItem;
  agentName?: string | null;
  onDismiss?: () => void;
  onMarkRead?: () => void;
}

export function InboxItemCard({ item, agentName, onDismiss, onMarkRead }: InboxItemCardProps) {
  const { context: blockContext } = useBlockActions({ surface: "inbox", surfaceId: item.id, isActioned: item.status === "actioned" });
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [needsExpand, setNeedsExpand] = useState(false);

  const isUnread = item.status === "unread";
  const priorityBarClass = PRIORITY_BAR_CLASSES[item.priority] ?? PRIORITY_BAR_CLASSES.normal;
  const statusCardClass = STATUS_CARD_CLASSES[item.status] ?? "";

  const handleContentRef = (el: HTMLDivElement | null) => {
    if (el) {
      (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      setNeedsExpand(el.scrollHeight > CONTENT_MAX_HEIGHT);
    }
  };

  return (
    <div className="group relative">
      {/* Priority indicator bar */}
      {item.priority !== "normal" && (
        <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-lg", priorityBarClass)} />
      )}

      <div
        className={cn(
          "border border-border rounded-lg p-4 bg-card transition-all duration-200",
          statusCardClass,
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={item.category} />
              <span className={cn(
                "text-sm text-foreground line-clamp-1",
                isUnread ? "font-semibold" : "font-medium",
              )}>
                {item.title}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {agentName && <Identity name={agentName} size="sm" />}
              {agentName && <span>·</span>}
              <span>{timeAgo(item.createdAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isUnread && onMarkRead && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onMarkRead}
                title="Mark as read"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDismiss && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onDismiss}
                title="Dismiss"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Content blocks */}
        {(item.contentBlocks || item.body) && (
          <div className="mt-3">
            <div
              ref={handleContentRef}
              className={cn(
                "rounded-md border border-border/30 bg-accent/5 p-3 space-y-3 relative",
                !expanded && needsExpand && "max-h-[200px] overflow-hidden",
              )}
            >
              <ContentRenderer blocks={item.contentBlocks} body={item.body} context={blockContext} className="text-sm" />
              {!expanded && needsExpand && (
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />
              )}
            </div>
            {needsExpand && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="mt-1 text-xs text-primary hover:underline"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {/* Actioned state */}
        {item.actionTaken && (
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
            <StatusBadge status="success" />
            <span className="text-xs text-muted-foreground">
              Action taken: {item.actionTaken.action}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
