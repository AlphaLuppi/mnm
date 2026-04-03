import { Folder as FolderIcon } from "lucide-react";
import type { Folder } from "@mnm/shared";

interface FolderCardProps {
  folder: Folder & { tags?: { id: string; name: string; color: string | null }[] };
  onClick: () => void;
}

export function FolderCard({ folder, onClick }: FolderCardProps) {
  const tags = folder.tags ?? [];

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
          <span className="text-sm font-medium truncate block">{folder.name}</span>
          {folder.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {folder.description}
            </p>
          )}
          {tags.length > 0 && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground"
                >
                  {tag.color && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                  )}
                  {tag.name}
                </span>
              ))}
            </div>
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
