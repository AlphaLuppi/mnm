import { useState } from "react";
import type { CreateUserWidget } from "@mnm/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TrendingDown, Activity, DollarSign, HeartPulse, Users } from "lucide-react";

const TEMPLATES: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  widget: CreateUserWidget;
}[] = [
  {
    label: "Burn-down",
    icon: TrendingDown,
    widget: {
      title: "Issue Burn-down",
      blocks: {
        schemaVersion: 1 as const,
        blocks: [
          {
            type: "chart" as const,
            chartType: "line" as const,
            title: "Burn-down",
            data: [
              { label: "Week 1", value: 40 },
              { label: "Week 2", value: 30 },
              { label: "Week 3", value: 18 },
              { label: "Week 4", value: 8 },
            ],
          },
        ],
      },
      span: 2,
    },
  },
  {
    label: "Velocity",
    icon: Activity,
    widget: {
      title: "Sprint Velocity",
      blocks: {
        schemaVersion: 1 as const,
        blocks: [
          {
            type: "chart" as const,
            chartType: "bar" as const,
            title: "Velocity",
            data: [
              { label: "Sprint 1", value: 24 },
              { label: "Sprint 2", value: 31 },
              { label: "Sprint 3", value: 28 },
              { label: "Sprint 4", value: 35 },
            ],
          },
        ],
      },
      span: 2,
    },
  },
  {
    label: "Cost Tracking",
    icon: DollarSign,
    widget: {
      title: "Cost Tracking",
      blocks: {
        schemaVersion: 1 as const,
        blocks: [
          {
            type: "metric-card" as const,
            label: "Monthly Cost",
            value: "$0.00",
            trend: "flat" as const,
            description: "Current billing period",
          },
        ],
      },
      span: 1,
    },
  },
  {
    label: "Health",
    icon: HeartPulse,
    widget: {
      title: "System Health",
      blocks: {
        schemaVersion: 1 as const,
        blocks: [
          {
            type: "stack" as const,
            direction: "vertical" as const,
            gap: "sm" as const,
            children: [
              { type: "status-badge" as const, text: "All agents healthy", variant: "success" as const },
              { type: "progress-bar" as const, label: "Uptime", value: 99, variant: "success" as const },
            ],
          },
        ],
      },
      span: 1,
    },
  },
  {
    label: "Workload",
    icon: Users,
    widget: {
      title: "Agent Workload",
      blocks: {
        schemaVersion: 1 as const,
        blocks: [
          {
            type: "chart" as const,
            chartType: "donut" as const,
            title: "Workload",
            data: [
              { label: "Active", value: 5, color: "hsl(var(--success))" },
              { label: "Idle", value: 3, color: "hsl(var(--muted-foreground))" },
              { label: "Error", value: 1, color: "hsl(var(--error))" },
            ],
          },
        ],
      },
      span: 2,
    },
  },
];

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateWidget: (data: CreateUserWidget) => Promise<void>;
}

export function AddWidgetDialog({ open, onOpenChange, onCreateWidget }: AddWidgetDialogProps) {
  const [caoPrompt, setCaoPrompt] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleTemplateClick(template: (typeof TEMPLATES)[number]) {
    setCreating(true);
    try {
      await onCreateWidget(template.widget);
    } finally {
      setCreating(false);
    }
  }

  async function handleCaoSubmit() {
    if (!caoPrompt.trim()) return;
    setCreating(true);
    try {
      // For now, store the prompt as a markdown widget. CAO integration will come later.
      await onCreateWidget({
        title: caoPrompt.trim().slice(0, 60),
        description: caoPrompt.trim(),
        blocks: {
          schemaVersion: 1,
          blocks: [
            {
              type: "markdown",
              content: `*Pending CAO generation...*\n\nPrompt: ${caoPrompt.trim()}`,
            },
          ],
        },
        span: 2,
      });
      setCaoPrompt("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Choose a template or describe what you want to see:
        </p>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Templates
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.label}
                  type="button"
                  disabled={creating}
                  onClick={() => handleTemplateClick(t)}
                  className="border border-border rounded-md p-3 hover:border-primary/50 hover:bg-accent/30 cursor-pointer transition-all text-center space-y-1.5 disabled:opacity-50"
                >
                  <Icon className="h-5 w-5 text-muted-foreground mx-auto" />
                  <span className="text-xs font-medium text-foreground block">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Ask CAO
          </p>
          <Textarea
            rows={2}
            placeholder="e.g., Show me issue burn-down for my team..."
            value={caoPrompt}
            onChange={(e) => setCaoPrompt(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!caoPrompt.trim() || creating}
              onClick={handleCaoSubmit}
            >
              {creating ? "Creating..." : "Send to CAO"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
