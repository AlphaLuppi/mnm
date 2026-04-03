import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { foldersApi, type FolderDetail } from "../../api/folders";
import { queryKeys } from "../../lib/queryKeys";
import { FolderShareManager } from "./FolderShareManager";
import { FolderItemList } from "./FolderItemList";
import { Button } from "@/components/ui/button";

interface FolderSidebarProps {
  companyId: string;
  folder: FolderDetail;
  onBack: () => void;
}

export function FolderSidebar({ companyId, folder, onBack }: FolderSidebarProps) {
  const queryClient = useQueryClient();
  const [instructions, setInstructions] = useState(folder.instructions ?? "");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    instructions: true,
    documents: true,
    sharing: false,
  });

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const invalidateFolder = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.folders.detail(companyId, folder.id),
    });

  const updateMutation = useMutation({
    mutationFn: (input: { instructions?: string | null }) =>
      foldersApi.update(companyId, folder.id, input),
    onSuccess: invalidateFolder,
  });

  const saveInstructions = useCallback(() => {
    const value = instructions.trim() || null;
    if (value !== (folder.instructions ?? null)) {
      updateMutation.mutate({ instructions: value });
    }
  }, [instructions, folder.instructions, updateMutation]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => foldersApi.upload(companyId, folder.id, file),
    onSuccess: invalidateFolder,
  });

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        uploadMutation.mutate(file);
      }
    },
    [uploadMutation],
  );

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      foldersApi.removeItem(companyId, folder.id, itemId),
    onSuccess: invalidateFolder,
  });

  const canEdit = folder.canEdit ?? false;

  return (
    <div className="h-full flex flex-col border-r border-border bg-background overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 mb-2"
          onClick={onBack}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {folder.icon ? (
            <span className="text-lg">{folder.icon}</span>
          ) : null}
          <h2 className="text-sm font-semibold truncate">{folder.name}</h2>
        </div>
        {folder.description && (
          <p className="text-xs text-muted-foreground mt-1">
            {folder.description}
          </p>
        )}
      </div>

      {/* Instructions section */}
      <div className="border-b border-border">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted/40"
          onClick={() => toggleSection("instructions")}
        >
          {expandedSections.instructions ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Instructions
        </button>
        {expandedSections.instructions && (
          <div className="px-3 pb-3">
            <textarea
              className="w-full min-h-[80px] rounded-md border border-border bg-background px-2 py-1.5 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Markdown instructions injected into every chat..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              onBlur={saveInstructions}
              readOnly={!canEdit}
            />
          </div>
        )}
      </div>

      {/* Documents section */}
      <div className="border-b border-border">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted/40"
          onClick={() => toggleSection("documents")}
        >
          {expandedSections.documents ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Documents & Items ({folder.items.length})
        </button>
        {expandedSections.documents && (
          <div className="px-3 pb-3 space-y-2">
            {canEdit && (
              <div
                className="border border-dashed border-border rounded-md p-3 text-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/40"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true;
                  input.onchange = () => {
                    if (input.files) {
                      Array.from(input.files).forEach((f) =>
                        uploadMutation.mutate(f),
                      );
                    }
                  };
                  input.click();
                }}
              >
                <Upload className="h-4 w-4 mx-auto mb-1" />
                Drop files or click to upload
              </div>
            )}
            <FolderItemList
              items={folder.items}
              onRemove={(itemId) => removeItemMutation.mutate(itemId)}
            />
          </div>
        )}
      </div>

      {/* Sharing section */}
      <div>
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted/40"
          onClick={() => toggleSection("sharing")}
        >
          {expandedSections.sharing ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Sharing
        </button>
        {expandedSections.sharing && (
          <div className="px-3 pb-3">
            <FolderShareManager
              companyId={companyId}
              folderId={folder.id}
              shares={folder.shares}
              folderTags={folder.tags}
              canEdit={canEdit}
            />
          </div>
        )}
      </div>
    </div>
  );
}
