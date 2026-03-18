import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Sparkles,
  Cpu,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TraceGold } from "../../api/traces";
import { cn } from "../../lib/utils";

interface GoldVerdictBannerProps {
  gold: TraceGold;
}

const verdictConfig = {
  success: {
    icon: CheckCircle,
    label: "Success",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    text: "text-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  partial: {
    icon: AlertTriangle,
    label: "Partial",
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-400",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  failure: {
    icon: XCircle,
    label: "Failure",
    bg: "bg-red-500/10 border-red-500/30",
    text: "text-red-400",
    badge: "bg-red-500/20 text-red-300 border-red-500/30",
  },
} as const;

export function GoldVerdictBanner({ gold }: GoldVerdictBannerProps) {
  const config = verdictConfig[gold.verdict];
  const Icon = config.icon;

  return (
    <div
      data-testid="trace-gold-verdict-banner"
      className={cn(
        "rounded-lg border p-4 space-y-3",
        config.bg,
      )}
    >
      {/* Verdict header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon className={cn("h-5 w-5", config.text)} />
          <span className={cn("text-sm font-semibold", config.text)}>
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] gap-1 border-border/50"
            data-testid="trace-gold-model-badge"
          >
            <Cpu className="h-3 w-3" />
            {gold.modelUsed}
          </Badge>
        </div>
      </div>

      {/* Verdict reason */}
      <p
        data-testid="trace-gold-verdict-reason"
        className="text-sm text-foreground/80 leading-relaxed"
      >
        {gold.verdictReason}
      </p>

      {/* Highlights */}
      {gold.highlights.length > 0 && (
        <div data-testid="trace-gold-highlights" className="space-y-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Highlights
          </span>
          <ul className="space-y-1">
            {gold.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground/70">
                <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Issue AC Status */}
      {gold.issueAcStatus && gold.issueAcStatus.length > 0 && (
        <div data-testid="trace-gold-ac-status" className="space-y-2 pt-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Acceptance Criteria
          </span>
          <div className="grid gap-2 sm:grid-cols-2">
            {gold.issueAcStatus.map((ac) => (
              <AcStatusCard key={ac.acId} ac={ac} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AcStatusCard({ ac }: { ac: NonNullable<TraceGold["issueAcStatus"]>[number] }) {
  const statusConfig = {
    met: { label: "Met", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    partial: { label: "Partial", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    not_met: { label: "Not Met", cls: "text-red-400 bg-red-500/10 border-red-500/20" },
    unknown: { label: "Unknown", cls: "text-muted-foreground bg-muted/30 border-border" },
  } as const;

  const cfg = statusConfig[ac.status];

  return (
    <div
      data-testid={`trace-gold-ac-${ac.acId}`}
      className={cn("rounded-md border p-2.5 text-xs space-y-1", cfg.cls)}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium truncate">{ac.label}</span>
        <Badge variant="outline" className={cn("text-[10px]", cfg.cls)}>
          {cfg.label}
        </Badge>
      </div>
      {ac.evidence && (
        <p className="text-[11px] text-foreground/60 leading-snug">{ac.evidence}</p>
      )}
    </div>
  );
}
