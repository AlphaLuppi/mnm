import * as specsRepo from "@/lib/db/repositories/specs";
import { SpecTree } from "@/components/specs/spec-tree";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { SpecReindexButton } from "@/components/specs/spec-reindex-button";

export const dynamic = "force-dynamic";

export default function SpecsPage() {
  let specs: ReturnType<typeof specsRepo.findAll> = [];
  try {
    specs = specsRepo.findAll();
  } catch {
    // DB may not be initialized yet
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Specs</h1>
          <p className="text-muted-foreground">
            Browse and search project specifications
          </p>
        </div>
        <SpecReindexButton />
      </div>
      <div className="min-h-0 flex-1 rounded-lg border">
        <SpecTree specs={specs} />
      </div>
    </div>
  );
}
