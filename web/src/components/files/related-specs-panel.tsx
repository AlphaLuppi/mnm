"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  FileSpreadsheet,
  Blocks,
  BookOpen,
  Settings,
  Link2Off,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";

interface LinkedSpec {
  id: string;
  title: string | null;
  specType: string;
  filePath: string;
  linkReason: string;
}

const typeIcons: Record<string, React.ElementType> = {
  product_brief: FileText,
  prd: FileSpreadsheet,
  architecture: Blocks,
  story: BookOpen,
  config: Settings,
};

interface RelatedSpecsPanelProps {
  filePath: string | null;
}

export function RelatedSpecsPanel({ filePath }: RelatedSpecsPanelProps) {
  const [specs, setSpecs] = useState<LinkedSpec[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filePath) {
      setSpecs([]);
      return;
    }
    setLoading(true);
    fetch(`/api/specs/related?file=${encodeURIComponent(filePath)}`)
      .then((r) => r.json())
      .then((data) => setSpecs(data.specs ?? []))
      .catch(() => setSpecs([]))
      .finally(() => setLoading(false));
  }, [filePath]);

  if (!filePath) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        Related Specs
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-2">
          {loading && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              Loading...
            </p>
          )}
          {!loading && specs.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
              <Link2Off className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">
                No related specs found
              </p>
            </div>
          )}
          {specs.map((spec) => {
            const Icon = typeIcons[spec.specType] ?? FileText;
            return (
              <Link key={spec.id} href={`/specs/${spec.id}`}>
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {spec.title ?? spec.filePath}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {spec.linkReason}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
