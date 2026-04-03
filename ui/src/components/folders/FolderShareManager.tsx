import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Tag, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { foldersApi } from "../../api/folders";
import { accessApi, type EnrichedMember } from "../../api/access";
import { tagsApi } from "../../api/tags";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "../../lib/utils";
import type { FolderShare } from "@mnm/shared";

interface FolderShareManagerProps {
  companyId: string;
  folderId: string;
  shares: FolderShare[];
  folderTags: { id: string; name: string; color: string | null }[];
  canEdit: boolean;
}

function memberDisplayName(m: EnrichedMember): string {
  if (m.userName) return m.userName;
  if (m.userEmail) return m.userEmail;
  return m.principalId.slice(0, 12);
}

function memberInitials(m: EnrichedMember): string {
  if (m.userName) {
    return m.userName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return (m.userEmail ?? m.principalId).slice(0, 2).toUpperCase();
}

export function FolderShareManager({
  companyId,
  folderId,
  shares,
  folderTags,
  canEdit,
}: FolderShareManagerProps) {
  const queryClient = useQueryClient();
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [newPermission, setNewPermission] = useState("viewer");
  const [tagsOpen, setTagsOpen] = useState(false);

  // Fetch company members for autocomplete
  const { data: members } = useQuery({
    queryKey: queryKeys.access.members(companyId),
    queryFn: () => accessApi.listMembers(companyId),
    enabled: canEdit,
  });

  const { data: companyTags } = useQuery({
    queryKey: queryKeys.tags.list(companyId, false),
    queryFn: () => tagsApi.list(companyId),
    enabled: canEdit,
  });

  // Members already shared with — exclude from picker
  const sharedUserIds = new Set(shares.map((s) => s.sharedWithUserId));

  const availableMembers = useMemo(
    () =>
      (members ?? []).filter(
        (m) => m.status === "active" && !sharedUserIds.has(m.principalId),
      ),
    [members, sharedUserIds],
  );

  // Build a lookup map for display names from members
  const memberMap = useMemo(() => {
    const map = new Map<string, EnrichedMember>();
    for (const m of members ?? []) {
      map.set(m.principalId, m);
    }
    return map;
  }, [members]);

  const invalidateFolder = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.folders.detail(companyId, folderId),
    });

  const addShareMutation = useMutation({
    mutationFn: (userId: string) =>
      foldersApi.addShare(companyId, folderId, {
        userId,
        permission: newPermission,
      }),
    onSuccess: invalidateFolder,
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
        <h4 className="text-xs font-medium text-muted-foreground">Users</h4>

        {shares.length === 0 && (
          <p className="text-xs text-muted-foreground">No user shares</p>
        )}

        {shares.map((share) => {
          const member = memberMap.get(share.sharedWithUserId);
          const displayName = member
            ? memberDisplayName(member)
            : share.sharedWithUserId.slice(0, 12);
          const email = member?.userEmail ?? null;

          return (
            <div key={share.id} className="flex items-center gap-2">
              {/* Avatar */}
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {member?.userImage ? (
                  <img
                    src={member.userImage}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {member ? memberInitials(member) : "??"}
                  </span>
                )}
              </div>

              {/* Name + email */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{displayName}</p>
                {email && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {email}
                  </p>
                )}
              </div>

              {/* Permission + remove */}
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
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground capitalize">
                  {share.permission}
                </span>
              )}
            </div>
          );
        })}

        {/* Add user combobox */}
        {canEdit && (
          <div className="flex items-center gap-2">
            <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 justify-between text-xs font-normal h-8"
                >
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <UserPlus className="h-3.5 w-3.5" />
                    Add user...
                  </span>
                  <ChevronsUpDown className="h-3 w-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search users..." className="h-8 text-xs" />
                  <CommandList>
                    <CommandEmpty className="py-3 text-xs text-center text-muted-foreground">
                      No users found.
                    </CommandEmpty>
                    <CommandGroup>
                      {availableMembers.map((member) => (
                        <CommandItem
                          key={member.principalId}
                          value={`${member.userName ?? ""} ${member.userEmail ?? ""} ${member.principalId}`}
                          onSelect={() => {
                            setUserPickerOpen(false);
                            addShareMutation.mutate(member.principalId);
                          }}
                          className="flex items-center gap-2 text-xs"
                        >
                          {/* Avatar */}
                          <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                            {member.userImage ? (
                              <img
                                src={member.userImage}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-[9px] font-medium text-muted-foreground">
                                {memberInitials(member)}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">
                              {memberDisplayName(member)}
                            </p>
                            {member.userEmail && member.userName && (
                              <p className="text-[10px] text-muted-foreground truncate">
                                {member.userEmail}
                              </p>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Select value={newPermission} onValueChange={setNewPermission}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
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
