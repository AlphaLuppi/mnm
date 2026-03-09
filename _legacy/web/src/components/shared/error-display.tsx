"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AlertCircle, ChevronDown, ExternalLink } from "lucide-react";
import { getErrorMapping } from "@/lib/core/error-messages";

interface ErrorDisplayProps {
  code?: string;
  message?: string;
  details?: string;
  onRetry?: () => void;
}

export function ErrorDisplay({
  code,
  message,
  details,
  onRetry,
}: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);
  const mapping = getErrorMapping(code ?? "UNKNOWN");

  const reportUrl = `/api/health`; // placeholder

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{mapping.title}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{message ?? mapping.description}</p>
        <p className="text-sm opacity-80">{mapping.suggestion}</p>

        {details && (
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
                <ChevronDown
                  className={`mr-1 h-3 w-3 transition-transform ${showDetails ? "rotate-180" : ""}`}
                />
                Technical Details
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-black/10 p-2 text-xs">
                {details}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="flex gap-2 pt-1">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
          {mapping.isCritical && (
            <Button variant="ghost" size="sm" asChild>
              <a
                href={reportUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                Report Issue
              </a>
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
