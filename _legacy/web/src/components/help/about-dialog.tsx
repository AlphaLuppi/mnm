"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>About MnM</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-center">
            <h2 className="text-lg font-bold">MnM</h2>
            <p className="text-sm text-muted-foreground">
              Product-First Agent Development Environment
            </p>
          </div>
          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-mono">0.1.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Framework</span>
              <span className="font-mono">Next.js 16</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">License</span>
              <span>Apache 2.0</span>
            </div>
          </div>
          <Separator />
          <p className="text-center text-xs text-muted-foreground">
            Built for developers who put product specs first.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
