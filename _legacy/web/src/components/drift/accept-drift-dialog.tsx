"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface AcceptDriftDialogProps {
  driftId: string;
  summary: string;
  onAccept: () => void;
  disabled?: boolean;
}

export function AcceptDriftDialog({
  summary,
  onAccept,
  disabled,
}: AcceptDriftDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Check className="h-4 w-4 mr-1" />
          Accept Drift
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Accept Drift?</AlertDialogTitle>
          <AlertDialogDescription>
            This marks the drift as intentional. You should update the spec to
            reflect the implementation changes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="text-sm text-muted-foreground border rounded-md p-3 my-2">
          {summary}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onAccept}>
            Accept Drift
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
