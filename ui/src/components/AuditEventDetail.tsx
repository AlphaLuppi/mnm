import type { AuditEvent } from "@mnm/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function severityVariant(severity: string): "secondary" | "outline" | "destructive" {
  switch (severity) {
    case "critical":
      return "destructive";
    case "error":
      return "destructive";
    case "warning":
      return "outline";
    default:
      return "secondary";
  }
}

interface AuditEventDetailProps {
  event: AuditEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditEventDetail({ event, open, onOpenChange }: AuditEventDetailProps) {
  if (!event) return null;

  const timestamp = event.createdAt
    ? new Date(event.createdAt).toLocaleString()
    : "N/A";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="obs-s04-detail-dialog" className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="obs-s04-detail-title">
            {event.action}
          </DialogTitle>
          <span
            data-testid="obs-s04-detail-timestamp"
            className="text-sm text-muted-foreground"
          >
            {timestamp}
          </span>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Event Info */}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="font-medium text-muted-foreground">ID</dt>
            <dd data-testid="obs-s04-detail-id" className="font-mono text-xs break-all">
              {event.id}
            </dd>

            <dt className="font-medium text-muted-foreground">Action</dt>
            <dd data-testid="obs-s04-detail-action">{event.action}</dd>

            <dt className="font-medium text-muted-foreground">Severity</dt>
            <dd>
              <Badge
                data-testid="obs-s04-detail-severity"
                variant={severityVariant(event.severity)}
                className={event.severity === "critical" ? "font-bold" : undefined}
              >
                {event.severity.charAt(0).toUpperCase() + event.severity.slice(1)}
              </Badge>
            </dd>

            <dt className="font-medium text-muted-foreground">Actor Type</dt>
            <dd data-testid="obs-s04-detail-actor-type">{event.actorType}</dd>

            <dt className="font-medium text-muted-foreground">Actor ID</dt>
            <dd data-testid="obs-s04-detail-actor-id" className="font-mono text-xs break-all">
              {event.actorId}
            </dd>

            <dt className="font-medium text-muted-foreground">Target Type</dt>
            <dd data-testid="obs-s04-detail-target-type">{event.targetType}</dd>

            <dt className="font-medium text-muted-foreground">Target ID</dt>
            <dd data-testid="obs-s04-detail-target-id" className="font-mono text-xs break-all">
              {event.targetId}
            </dd>

            <dt className="font-medium text-muted-foreground">IP Address</dt>
            <dd data-testid="obs-s04-detail-ip">{event.ipAddress ?? "N/A"}</dd>

            <dt className="font-medium text-muted-foreground">User Agent</dt>
            <dd data-testid="obs-s04-detail-user-agent" className="break-all">
              {event.userAgent ?? "N/A"}
            </dd>
          </dl>

          {/* Metadata */}
          <div>
            <h4 className="font-medium text-muted-foreground mb-1">Metadata</h4>
            <pre
              data-testid="obs-s04-detail-metadata"
              className="rounded-md border border-border bg-muted/30 p-3 text-xs overflow-x-auto max-h-48 overflow-y-auto"
            >
              {event.metadata
                ? JSON.stringify(event.metadata, null, 2)
                : "No metadata"}
            </pre>
          </div>

          {/* Hash Chain */}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="font-medium text-muted-foreground">Prev Hash</dt>
            <dd data-testid="obs-s04-detail-prev-hash" className="font-mono text-xs break-all">
              {event.prevHash ?? "N/A"}
            </dd>
          </dl>
        </div>

        <DialogFooter>
          <Button
            data-testid="obs-s04-detail-close"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
