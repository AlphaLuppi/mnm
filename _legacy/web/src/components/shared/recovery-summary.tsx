"use client";

import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";

interface RecoverySummaryProps {
  agentsStopped: number;
  locksReleased: number;
  dbIntegrityOk: boolean;
}

export function RecoverySummary({
  agentsStopped,
  locksReleased,
  dbIntegrityOk,
}: RecoverySummaryProps) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 30000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <Alert className="relative mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Recovered from unexpected shutdown</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 text-sm">
          {agentsStopped > 0 && (
            <li>
              {agentsStopped} agent{agentsStopped !== 1 ? "s were" : " was"}{" "}
              terminated
            </li>
          )}
          {locksReleased > 0 && (
            <li>
              {locksReleased} file lock{locksReleased !== 1 ? "s" : ""} released
            </li>
          )}
          <li>
            Database integrity: {dbIntegrityOk ? "OK" : "Issues detected"}
          </li>
        </ul>
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6"
        onClick={() => setVisible(false)}
        aria-label="Dismiss recovery notice"
      >
        <X className="h-3 w-3" />
      </Button>
    </Alert>
  );
}
