import { Button } from "@/components/ui/button";
import { LayoutDashboard, Plus, Sparkles } from "lucide-react";

interface DashboardEmptyStateProps {
  variant: "new-user" | "all-deleted";
  onAddWidget: () => void;
}

export function DashboardEmptyState({ variant, onAddWidget }: DashboardEmptyStateProps) {
  if (variant === "new-user") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-16 text-center bg-card/50">
        <LayoutDashboard className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-medium text-foreground">
          Your dashboard is empty
        </h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Add widgets to monitor your agents, track issues, and stay on top of costs.
        </p>
        <Button className="mt-6" onClick={onAddWidget}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Your First Widget
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
      <Sparkles className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <h3 className="text-sm font-medium text-foreground">
        No widgets on your dashboard
      </h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        Add a preset widget or ask CAO to create something custom for you.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onAddWidget}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Widget
      </Button>
    </div>
  );
}
