import type { MetricCardBlock as MetricCardBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
} as const;

const TREND_COLORS = {
  up: "text-green-500",
  down: "text-red-500",
  flat: "text-muted-foreground",
} as const;

export function MetricCardBlock({ block }: { block: MetricCardBlockType; context: BlockContext }) {
  const TrendIcon = block.trend ? TREND_ICONS[block.trend] : null;

  return (
    <div className="px-4 py-3 rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{block.label}</p>
          <p className="text-2xl font-semibold tracking-tight mt-0.5">{block.value}</p>
          {block.description && (
            <p className="text-xs text-muted-foreground/70 mt-1">{block.description}</p>
          )}
        </div>
        {TrendIcon && (
          <TrendIcon className={`h-3.5 w-3.5 shrink-0 ${TREND_COLORS[block.trend!]}`} />
        )}
      </div>
    </div>
  );
}
