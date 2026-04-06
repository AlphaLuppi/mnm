import type { ProgressBarBlock as ProgressBarBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";

const FILL_COLORS: Record<NonNullable<ProgressBarBlockType["variant"]>, string> = {
  default: "bg-primary",
  success: "bg-green-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

export function ProgressBarBlock({ block }: { block: ProgressBarBlockType; context: BlockContext }) {
  const fillColor = FILL_COLORS[block.variant ?? "default"];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{block.label}</span>
        <span className="text-xs font-medium text-foreground">{block.value}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${fillColor}`}
          style={{ width: `${block.value}%` }}
        />
      </div>
    </div>
  );
}
