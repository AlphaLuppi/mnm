import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Folder as FolderIcon, Plus, Search } from "lucide-react";
import { foldersApi } from "../../api/folders";
import { queryKeys } from "../../lib/queryKeys";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface FolderPickerProps {
  companyId: string;
  open: boolean;
  onSelect: (folderId: string) => void;
  onClose: () => void;
  onCreateNew?: () => void;
}

export function FolderPicker({
  companyId,
  open,
  onSelect,
  onClose,
  onCreateNew,
}: FolderPickerProps) {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.folders.list(companyId),
    queryFn: () => foldersApi.list(companyId),
    enabled: open && !!companyId,
  });

  const folders = (data?.folders ?? []).filter((f) =>
    search ? f.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Save to Folder</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search folders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <div className="max-h-60 overflow-y-auto space-y-1 py-1">
          {isLoading && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Loading...
            </p>
          )}

          {!isLoading && folders.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              {search ? "No matching folders" : "No folders yet"}
            </p>
          )}

          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onSelect(folder.id)}
              className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors"
            >
              {folder.icon ? (
                <span className="text-base">{folder.icon}</span>
              ) : (
                <FolderIcon className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="flex-1 truncate">{folder.name}</span>
              {folder.itemCount != null && (
                <span className="text-xs text-muted-foreground">
                  {folder.itemCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {onCreateNew && (
          <Button variant="outline" size="sm" className="w-full" onClick={onCreateNew}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Folder
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
