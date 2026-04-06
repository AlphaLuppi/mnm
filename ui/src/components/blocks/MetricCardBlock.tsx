import { MetricCardProps } from "@mnm/shared";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";


const TREND_ICONS = {
  up: <TrendingUp className="h-4 w-4 text-emerald-500" />,
  down: <TrendingDown className="h-4 w-4 text-red-500" />,
  flat: <Minus className="h-4 w-4 text-muted-foreground" />,
} as const;

export function MnmMetricCard({ props }: { props: typeof MetricCardProps._type }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{props.label}</span>
        {props.trend && TREND_ICONS[props.trend]}
      </div>
      <div className="text-2xl font-bold">{props.value}</div>
      {props.description && (
        <p className="text-xs text-muted-foreground">{props.description}</p>
      )}
    </div>
  );
}
