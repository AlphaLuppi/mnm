import { Folder as FolderIcon, Lock, Globe, Tag } from "lucide-react";
import type { Folder } from "@mnm/shared";

interface FolderCardProps {
  folder: Folder & { tags?: { id: string; name: string; color: string | null }[] };
  onClick: () => void;
}

export function FolderCard({ folder, onClick }: FolderCardProps) {
  const tagCount = folder.tags?.length ?? 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-border rounded-lg p-4 hover:bg-muted/40 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-md bg-muted">
          {folder.icon ? (
            <span className="text-lg">{folder.icon}</span>
          ) : (
            <FolderIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{folder.name}</span>
            {folder.visibility === "private" ? (
              <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
            ) : (
              <Globe className="h-3 w-3 text-blue-500 shrink-0" />
            )}
            {tagCount > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                <Tag className="h-2.5 w-2.5" />
                {tagCount}
              </span>
            )}
          </div>
          {folder.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {folder.description}
            </p>
          )}
          {folder.itemCount != null && (
            <p className="text-xs text-muted-foreground mt-1">
              {folder.itemCount} items
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
