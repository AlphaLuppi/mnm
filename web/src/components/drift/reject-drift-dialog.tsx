"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

interface RejectDriftDialogProps {
  specTitle: string;
  onReject: (taskTitle: string, notes: string) => void;
  disabled?: boolean;
}

export function RejectDriftDialog({
  specTitle,
  onReject,
  disabled,
}: RejectDriftDialogProps) {
  const [open, setOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState(`Fix drift in ${specTitle}`);
  const [notes, setNotes] = useState("");

  function handleSubmit() {
    onReject(taskTitle, notes);
    setOpen(false);
    setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" disabled={disabled}>
          <X className="h-4 w-4 mr-1" />
          Reject Drift
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Drift & Create Remediation Task</DialogTitle>
          <DialogDescription>
            Create a task to fix this drift and realign code with the spec.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Task Title</label>
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional context for the remediation task..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!taskTitle.trim()}>
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
