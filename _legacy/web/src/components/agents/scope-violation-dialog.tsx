"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ScopeViolationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  filePath: string;
  scope: string[];
  onExpandScope: () => void;
  onDeny: () => void;
  onTerminate: () => void;
}

export function ScopeViolationDialog({
  open,
  onOpenChange,
  agentName,
  filePath,
  scope,
  onExpandScope,
  onDeny,
  onTerminate,
}: ScopeViolationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Scope Violation</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{agentName}</strong> attempted to modify a file outside its
            declared scope:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 rounded bg-muted p-3 text-sm">
          <p>
            <span className="font-medium">File:</span>{" "}
            <code className="text-xs">{filePath}</code>
          </p>
          <p>
            <span className="font-medium">Declared scope:</span>
          </p>
          <ul className="list-inside list-disc text-xs text-muted-foreground">
            {scope.map((s) => (
              <li key={s}>
                <code>{s}</code>
              </li>
            ))}
          </ul>
        </div>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onExpandScope}>
            Expand Scope
          </Button>
          <Button variant="secondary" onClick={onDeny}>
            Deny
          </Button>
          <Button variant="destructive" onClick={onTerminate}>
            Terminate Agent
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
