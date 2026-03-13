"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ContextualHintProps {
  id: string;
  children: React.ReactNode;
}

export function ContextualHint({ id, children }: ContextualHintProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const key = `mnm-hint-${id}`;
    setDismissed(localStorage.getItem(key) === "dismissed");
  }, [id]);

  function dismiss() {
    localStorage.setItem(`mnm-hint-${id}`, "dismissed");
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
      <div className="flex-1 text-blue-800 dark:text-blue-200">{children}</div>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0"
        onClick={dismiss}
        aria-label="Dismiss hint"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
