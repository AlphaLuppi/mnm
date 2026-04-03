import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Trash2 } from "lucide-react";
import { foldersApi } from "../../api/folders";
import { queryKeys } from "../../lib/queryKeys";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "../../lib/utils";

interface FolderDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  folderId: string;
  folderName: string;
  onConfirm: (preserveDocumentIds: string[]) => void;
  isPending: boolean;
}

export function FolderDeleteDialog({
  open,
  onOpenChange,
  companyId,
  folderId,
  folderName,
  onConfirm,
  isPending,
}: FolderDeleteDialogProps) {
  const [preserveIds, setPreserveIds] = useState<Set<string>>(new Set());

  const { data: preview, isLoading } = useQuery({
    queryKey: queryKeys.folders.deletionPreview(companyId, folderId),
    queryFn: () => foldersApi.getDeletionPreview(companyId, folderId),
    enabled: open,
  });

  const togglePreserve = (id: string) => {
    setPreserveIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const nativeDocs = preview?.nativeDocuments ?? [];
  const hasNativeDocs = nativeDocs.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete "{folderName}"</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading...</p>
        ) : (
          <div className="space-y-4 py-2">
            {hasNativeDocs ? (
              <>
                <p className="text-sm text-muted-foreground">
                  This folder contains {nativeDocs.length} native document(s).
                  Select the ones you want to <strong>keep</strong> as standalone
                  documents. Unselected documents will be deleted.
                </p>
                <div className="max-h-60 overflow-auto rounded-md border divide-y">
                  {nativeDocs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => togglePreserve(doc.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center gap-2",
                        preserveIds.has(doc.id) && "bg-primary/5",
                      )}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{doc.title}</span>
                      {preserveIds.has(doc.id) && (
                        <span className="text-xs text-primary font-medium shrink-0">
                          Keep
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete "{folderName}"? Imported items
                will be unlinked but not deleted. This cannot be undone.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(Array.from(preserveIds))}
            disabled={isPending || isLoading}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            {isPending ? "Deleting..." : "Delete Folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
