import { ProgressBarProps } from "@mnm/shared";



const VARIANT_COLORS: Record<string, string> = {
  default: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

export function MnmProgressBar({ props }: { props: typeof ProgressBarProps._type }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{props.label}</span>
        <span className="text-muted-foreground">{props.value}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${VARIANT_COLORS[props.variant ?? "default"]}`}
          style={{ width: `${Math.min(100, Math.max(0, props.value))}%` }}
        />
      </div>
    </div>
  );
}
