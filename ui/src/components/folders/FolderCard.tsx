import { Folder as FolderIcon, Lock, Users } from "lucide-react";
import type { Folder } from "@mnm/shared";

interface FolderCardProps {
  folder: Folder;
  onClick: () => void;
}

export function FolderCard({ folder, onClick }: FolderCardProps) {
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
              <Users className="h-3 w-3 text-blue-500 shrink-0" />
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
