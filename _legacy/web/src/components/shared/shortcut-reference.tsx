"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SHORTCUTS, formatShortcut } from "@/lib/core/keyboard-shortcuts";

interface ShortcutReferenceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutReference({ open, onOpenChange }: ShortcutReferenceProps) {
  const categories = [...new Set(SHORTCUTS.map((s) => s.category))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat}>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                {cat}
              </h3>
              <div className="space-y-1">
                {SHORTCUTS.filter((s) => s.category === cat).map((s) => (
                  <div
                    key={s.action}
                    className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted"
                  >
                    <span>{s.label}</span>
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {formatShortcut(s)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
