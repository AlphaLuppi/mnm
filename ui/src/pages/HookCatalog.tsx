import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";

import {
  hooksApi,
  filterCatalogBySource,
  type HookCatalogEntry,
  type HookCatalogSource,
} from "../api/hooks";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CatalogTab = HookCatalogSource | "all";

const TAB_LABEL: Record<CatalogTab, string> = {
  all: "Tous",
  canonical: "Canonical",
  shared: "Shared",
  local: "Local",
};

const SOURCE_VARIANT: Record<HookCatalogSource, "default" | "secondary" | "outline"> = {
  canonical: "default",
  shared: "secondary",
  local: "outline",
};

/**
 * Read-only catalog of available hook entries (canonical / shared / local),
 * optionally filtered by `workflow_ref`.
 */
export function HookCatalog({ companyId }: { companyId: string }) {
  const [tab, setTab] = useState<CatalogTab>("all");
  const [workflowRef, setWorkflowRef] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.hooks.catalog(companyId, workflowRef || undefined),
    queryFn: () => hooksApi.catalog(companyId, workflowRef || undefined),
    enabled: !!companyId,
  });

  const entries = useMemo<HookCatalogEntry[]>(() => {
    if (!data) return [];
    return filterCatalogBySource(data, tab);
  }, [data, tab]);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-sm">
          <Label htmlFor="hooks-catalog-workflow-ref" className="text-xs">
            Filtrer par workflow_ref (optionnel)
          </Label>
          <Input
            id="hooks-catalog-workflow-ref"
            data-testid="hooks-catalog-workflow-ref"
            placeholder="ex: shared:feature-dev"
            value={workflowRef}
            onChange={(e) => setWorkflowRef(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as CatalogTab)}>
        <TabsList>
          {(Object.keys(TAB_LABEL) as CatalogTab[]).map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              data-testid={`hooks-catalog-tab-${t}`}
            >
              {TAB_LABEL[t]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <PageSkeleton />
          ) : error ? (
            <p className="text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "Impossible de charger le catalog."}
            </p>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              message={
                workflowRef
                  ? `Aucun hook trouvé pour workflow_ref="${workflowRef}".`
                  : "Aucun hook disponible dans ce catalog."
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {entries.map((entry) => (
                <CatalogCard
                  key={`${entry.source}:${entry.ref}`}
                  entry={entry}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CatalogCard({ entry }: { entry: HookCatalogEntry }) {
  return (
    <Card data-testid={`hooks-catalog-entry-${entry.ref}`}>
      <CardContent className="py-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium truncate">{entry.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              <code>{entry.ref}</code>
            </p>
          </div>
          <Badge variant={SOURCE_VARIANT[entry.source]}>{entry.source}</Badge>
        </div>
        {entry.description && (
          <p className="text-xs text-muted-foreground">{entry.description}</p>
        )}
      </CardContent>
    </Card>
  );
}
