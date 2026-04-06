import { Suspense } from "react";
import type { DashboardWidget } from "@mnm/shared";
import { WIDGET_REGISTRY } from "../lib/widget-registry";
import { cn } from "../lib/utils";

const SPAN_CLASSES: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-1 md:col-span-2",
  3: "col-span-1 md:col-span-3",
  4: "col-span-1 md:col-span-4",
};

function WidgetSkeleton() {
  return <div className="animate-pulse bg-muted rounded-lg min-h-[120px]" />;
}

interface DashboardGridProps {
  companyId: string;
  widgets: DashboardWidget[];
}

export function DashboardGrid({ companyId, widgets }: DashboardGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {widgets.map((widget, i) => {
        const def = WIDGET_REGISTRY[widget.type];
        if (!def) return null;
        const Widget = def.component;
        const span = widget.span ?? def.defaultSpan;
        return (
          <div key={`${widget.type}-${i}`} className={cn(SPAN_CLASSES[span] ?? "col-span-1")}>
            <Suspense fallback={<WidgetSkeleton />}>
              <Widget companyId={companyId} span={span} props={widget.props} />
            </Suspense>
          </div>
        );
      })}
    </div>
  );
}
