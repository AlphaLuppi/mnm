import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Tag, Trash2 } from "lucide-react";
import { foldersApi } from "../../api/folders";
import { tagsApi } from "../../api/tags";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { FolderShare } from "@mnm/shared";

interface FolderShareManagerProps {
  companyId: string;
  folderId: string;
  shares: FolderShare[];
  folderTags: { id: string; name: string; color: string | null }[];
  canEdit: boolean;
}

export function FolderShareManager({
  companyId,
  folderId,
  shares,
  folderTags,
  canEdit,
}: FolderShareManagerProps) {
  const queryClient = useQueryClient();
  const [newUserId, setNewUserId] = useState("");
  const [newPermission, setNewPermission] = useState("viewer");
  const [tagsOpen, setTagsOpen] = useState(false);

  const { data: companyTags } = useQuery({
    queryKey: queryKeys.tags.list(companyId, false),
    queryFn: () => tagsApi.list(companyId),
    enabled: canEdit,
  });

  const invalidateFolder = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.folders.detail(companyId, folderId),
    });

  const addShareMutation = useMutation({
    mutationFn: () =>
      foldersApi.addShare(companyId, folderId, {
        userId: newUserId,
        permission: newPermission,
      }),
    onSuccess: () => {
      invalidateFolder();
      setNewUserId("");
    },
  });

  const removeShareMutation = useMutation({
    mutationFn: (shareId: string) =>
      foldersApi.removeShare(companyId, folderId, shareId),
    onSuccess: invalidateFolder,
  });

  const updateShareMutation = useMutation({
    mutationFn: ({
      shareId,
      permission,
    }: {
      shareId: string;
      permission: string;
    }) => foldersApi.updateShare(companyId, folderId, shareId, { permission }),
    onSuccess: invalidateFolder,
  });

  const addTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      foldersApi.addTag(companyId, folderId, tagId),
    onSuccess: invalidateFolder,
  });

  const removeTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      foldersApi.removeTag(companyId, folderId, tagId),
    onSuccess: invalidateFolder,
  });

  const folderTagIds = folderTags.map((t) => t.id);
  const availableTags = (companyTags ?? []).filter(
    (t) => !folderTagIds.includes(t.id),
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Sharing</h3>

      {/* User shares */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground">
          Users
        </h4>
        {shares.length === 0 && (
          <p className="text-xs text-muted-foreground">No user shares</p>
        )}
        {shares.map((share) => (
          <div key={share.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate text-xs">
              {share.sharedWithUserId}
            </span>
            {canEdit ? (
              <>
                <Select
                  value={share.permission}
                  onValueChange={(v) =>
                    updateShareMutation.mutate({
                      shareId: share.id,
                      permission: v,
                    })
                  }
                >
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeShareMutation.mutate(share.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                {share.permission}
              </span>
            )}
          </div>
        ))}

        {canEdit && (
          <div className="flex items-center gap-2">
            <Input
              placeholder="User ID"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              className="h-8 text-xs flex-1"
            />
            <Select value={newPermission} onValueChange={setNewPermission}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addShareMutation.mutate()}
              disabled={!newUserId.trim() || addShareMutation.isPending}
            >
              <UserPlus className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Tag shares */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground">
          Tags (group access — read only)
        </h4>
        <div className="flex items-center gap-1.5 flex-wrap">
          {folderTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs"
            >
              {tag.color && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
              )}
              {tag.name}
              {canEdit && (
                <button
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => removeTagMutation.mutate(tag.id)}
                >
                  &times;
                </button>
              )}
            </span>
          ))}
          {canEdit && (
            <Popover open={tagsOpen} onOpenChange={setTagsOpen}>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                  <Tag className="h-3 w-3" />
                  Add tag
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1" align="start">
                {availableTags.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    All tags assigned
                  </p>
                ) : (
                  availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                      onClick={() => {
                        setTagsOpen(false);
                        addTagMutation.mutate(tag.id);
                      }}
                    >
                      {tag.color && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                      )}
                      <span className="truncate">{tag.name}</span>
                    </button>
                  ))
                )}
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </div>
  );
}
