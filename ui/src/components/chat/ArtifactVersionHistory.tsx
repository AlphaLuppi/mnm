import { useQuery } from "@tanstack/react-query";
import { Clock, ChevronRight } from "lucide-react";
import type { ArtifactVersion } from "@mnm/shared";
import { artifactsApi } from "../../api/artifacts";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../lib/utils";

interface ArtifactVersionHistoryProps {
  companyId: string;
  artifactId: string;
  currentVersionId: string | null;
  onSelectVersion: (version: ArtifactVersion) => void;
}

function formatVersionTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ArtifactVersionHistory({
  companyId,
  artifactId,
  currentVersionId,
  onSelectVersion,
}: ArtifactVersionHistoryProps) {
  const versionsQuery = useQuery({
    queryKey: queryKeys.artifacts.versions(companyId, artifactId),
    queryFn: () => artifactsApi.getVersions(companyId, artifactId),
    enabled: !!companyId && !!artifactId,
  });

  const versions = versionsQuery.data ?? [];

  if (versionsQuery.isLoading) {
    return (
      <div className="px-3 py-4 text-xs text-muted-foreground text-center">
        Loading versions...
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-muted-foreground text-center">
        No version history available.
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      <div className="px-3 py-2 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Clock className="h-3 w-3" />
        Version History
      </div>
      <div className="max-h-48 overflow-y-auto">
        {versions.map((version) => {
          const isCurrent = version.id === currentVersionId;
          return (
            <button
              key={version.id}
              type="button"
              className={cn(
                "w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2",
                isCurrent && "bg-primary/5",
              )}
              onClick={() => onSelectVersion(version)}
            >
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">v{version.versionNumber}</span>
                  {isCurrent && (
                    <span className="text-[10px] text-primary font-medium">
                      current
                    </span>
                  )}
                </div>
                {version.changeSummary && (
                  <p className="text-muted-foreground truncate mt-0.5">
                    {version.changeSummary}
                  </p>
                )}
                <p className="text-muted-foreground/70 mt-0.5">
                  {formatVersionTime(version.createdAt)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
