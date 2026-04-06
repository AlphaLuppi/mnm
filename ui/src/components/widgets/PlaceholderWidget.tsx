import { Package } from "lucide-react";
import type { WidgetProps } from "./types";

/** Placeholder for widgets not yet implemented */
export default function PlaceholderWidget({ props }: WidgetProps & { widgetType?: string }) {
  const label = (props?.label as string) ?? "Coming Soon";
  return (
    <div className="border border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center gap-2 min-h-[120px]">
      <Package className="h-6 w-6 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
