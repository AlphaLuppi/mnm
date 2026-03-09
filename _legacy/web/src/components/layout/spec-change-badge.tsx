"use client";

import { useState } from "react";
import useSWR from "swr";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChangeSummaryPanel } from "@/components/specs/change-summary-panel";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function SpecChangeBadge() {
  const [open, setOpen] = useState(false);
  const { data } = useSWR("/api/git/changes?viewed=false", fetcher);

  const count = data?.changes?.length ?? 0;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <Badge
            variant="destructive"
            className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px]"
          >
            {count}
          </Badge>
        )}
      </Button>
      <ChangeSummaryPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
