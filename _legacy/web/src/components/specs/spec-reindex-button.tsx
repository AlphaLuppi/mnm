"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SpecReindexButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleReindex() {
    setLoading(true);
    try {
      await fetch("/api/specs", { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleReindex} disabled={loading}>
      <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Indexing..." : "Re-index"}
    </Button>
  );
}
