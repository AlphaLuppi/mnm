"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DiffNavigatorProps {
  files: string[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export function DiffNavigator({
  files,
  currentIndex,
  onNavigate,
}: DiffNavigatorProps) {
  if (files.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={currentIndex === 0}
        onClick={() => onNavigate(currentIndex - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>
      <Badge variant="secondary">
        File {currentIndex + 1} of {files.length}
      </Badge>
      <Button
        variant="outline"
        size="sm"
        disabled={currentIndex === files.length - 1}
        onClick={() => onNavigate(currentIndex + 1)}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
