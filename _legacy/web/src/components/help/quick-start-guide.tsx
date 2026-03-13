"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface QuickStartGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  {
    title: "Browse Specs",
    description:
      "Navigate to the Specs tab to see all your project specifications. MnM indexes markdown files from your repository and organizes them by type.",
  },
  {
    title: "Launch an Agent",
    description:
      "Select a spec and click 'Launch Agent' to start an AI agent. The agent will implement code based on the specification while staying within its declared scope.",
  },
  {
    title: "Monitor Drift",
    description:
      "The Drift tab shows when code diverges from your specs. MnM uses Claude to analyze changes and flag potential specification violations.",
  },
  {
    title: "Track Progress",
    description:
      "The Progress view gives you a high-level overview of which stories are in progress, completed, or drifting from their specs.",
  },
];

export function QuickStartGuide({ open, onOpenChange }: QuickStartGuideProps) {
  const [step, setStep] = useState(0);

  function handleClose() {
    setStep(0);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Start Guide</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <div className="min-h-[100px]">
            <h3 className="font-medium">
              {step + 1}. {STEPS[step].title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {STEPS[step].description}
            </p>
          </div>
        </div>
        <DialogFooter>
          {step > 0 && (
            <Button
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
          ) : (
            <Button onClick={handleClose}>Get Started</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
