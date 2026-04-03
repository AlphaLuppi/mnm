import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Folder as FolderIcon,
  Lock,
  Globe,
  Pencil,
  Trash2,
  ArrowLeft,
  Plus,
  FileText,
  Code2,
  MessageSquare,
  Check,
  Tag,
} from "lucide-react";
import { useParams, useNavigate } from "../lib/router";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { foldersApi } from "../api/folders";
import { tagsApi } from "../api/tags";
import { documentsApi } from "../api/documents";
import { artifactsApi } from "../api/artifacts";
import { chatApi } from "../api/chat";
import { queryKeys } from "../lib/queryKeys";
import { FolderItemList } from "../components/folders/FolderItemList";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "../lib/utils";
import type { FolderVisibility, FolderItemType } from "@mnm/shared";

const VISIBILITY_OPTIONS: { value: FolderVisibility; label: string }[] = [
  { value: "private", label: "Private" },
  { value: "public", label: "Public" },
];

export function FolderDetail() {
  const { folderId } = useParams<{ folderId: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    visibility: FolderVisibility;
  }>({ name: "", description: "", visibility: "private" });
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemType, setAddItemType] = useState<FolderItemType>("document");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [tagsOpen, setTagsOpen] = useState(false);

  const {
    data: folder,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.folders.detail(selectedCompanyId!, folderId!),
    queryFn: () => foldersApi.getById(selectedCompanyId!, folderId!),
    enabled: !!selectedCompanyId && !!folderId,
  });

  useEffect(() => {
    if (folder) {
      setBreadcrumbs([
        { label: "Folders", href: "/folders" },
        { label: folder.name },
      ]);
    } else {
      setBreadcrumbs([
        { label: "Folders", href: "/folders" },
        { label: "..." },
      ]);
    }
    return () => setBreadcrumbs([]);
  }, [folder, setBreadcrumbs]);

  // Populate edit form when folder loads
  useEffect(() => {
    if (folder) {
      setEditForm({
        name: folder.name,
        description: folder.description ?? "",
        visibility: folder.visibility,
      });
    }
  }, [folder]);

  const updateMutation = useMutation({
    mutationFn: (input: { name?: string; description?: string; visibility?: string }) =>
      foldersApi.update(selectedCompanyId!, folderId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.detail(selectedCompanyId!, folderId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.list(selectedCompanyId!),
      });
      setEditOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => foldersApi.delete(selectedCompanyId!, folderId!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.list(selectedCompanyId!),
      });
      navigate("/folders");
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      foldersApi.removeItem(selectedCompanyId!, folderId!, itemId),
    onMutate: (itemId) => setRemovingItemId(itemId),
    onSettled: () => setRemovingItemId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.detail(selectedCompanyId!, folderId!),
      });
    },
  });

  const documentsQuery = useQuery({
    queryKey: queryKeys.documents.list(selectedCompanyId!),
    queryFn: () => documentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && addItemOpen && addItemType === "document",
  });

  const artifactsQuery = useQuery({
    queryKey: queryKeys.artifacts.list(selectedCompanyId!),
    queryFn: () => artifactsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && addItemOpen && addItemType === "artifact",
  });

  const channelsQuery = useQuery({
    queryKey: queryKeys.chat.channels(selectedCompanyId!),
    queryFn: () => chatApi.listChannels(selectedCompanyId!),
    enabled: !!selectedCompanyId && addItemOpen && addItemType === "channel",
  });

  const addItemMutation = useMutation({
    mutationFn: (input: { itemType: FolderItemType; artifactId?: string; documentId?: string; channelId?: string }) =>
      foldersApi.addItem(selectedCompanyId!, folderId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.detail(selectedCompanyId!, folderId!),
      });
      setAddItemOpen(false);
      setSelectedItemId(null);
    },
  });

  // Tag management
  const { data: companyTags } = useQuery({
    queryKey: queryKeys.tags.list(selectedCompanyId!, false),
    queryFn: () => tagsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const folderTagIds: string[] = (folder as any)?.tags?.map((t: any) => t.id) ?? [];

  const addTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      foldersApi.addTag(selectedCompanyId!, folderId!, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.detail(selectedCompanyId!, folderId!),
      });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      foldersApi.removeTag(selectedCompanyId!, folderId!, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.detail(selectedCompanyId!, folderId!),
      });
    },
  });

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (error || !folder) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/folders")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Folders
        </Button>
        <p className="text-sm text-destructive">
          {error ? "Failed to load folder." : "Folder not found."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/folders")}>
        <ArrowLeft className="h-4 w-4" />
        Folders
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-md bg-muted">
            {folder.icon ? (
              <span className="text-xl">{folder.icon}</span>
            ) : (
              <FolderIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{folder.name}</h1>
              {folder.visibility === "private" ? (
                <Lock className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Globe className="h-4 w-4 text-blue-500" />
              )}
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  folder.visibility === "public"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {folder.visibility}
              </span>
            </div>
            {folder.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {folder.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" title="Edit folder" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Delete folder"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">
            Items{" "}
            {folder.items && (
              <span className="text-muted-foreground">({folder.items.length})</span>
            )}
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAddItemType("document");
              setSelectedItemId(null);
              setAddItemOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Item
          </Button>
        </div>
        <FolderItemList
          items={folder.items ?? []}
          onRemove={(itemId) => removeItemMutation.mutate(itemId)}
          removing={removingItemId}
        />
      </div>

      {/* Tags section (only for public folders) */}
      {folder.visibility === "public" && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium">Tags</h2>
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 flex-wrap">
              {folderTagIds.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  No tags assigned — visible to everyone in the company
                </span>
              )}
              {folderTagIds.map((tagId: string) => {
                const tag = (companyTags ?? []).find((t) => t.id === tagId);
                if (!tag) return null;
                return (
                  <span
                    key={tagId}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs"
                  >
                    {tag.color && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                    )}
                    {tag.name}
                    <button
                      className="ml-0.5 text-muted-foreground hover:text-foreground"
                      onClick={() => removeTagMutation.mutate(tagId)}
                    >
                      &times;
                    </button>
                  </span>
                );
              })}
              <Popover open={tagsOpen} onOpenChange={setTagsOpen}>
                <PopoverTrigger asChild>
                  <button className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                    <Tag className="h-3 w-3" />
                    Add tag
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="start">
                  {(companyTags ?? []).filter((t) => !folderTagIds.includes(t.id)).length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">All tags assigned</p>
                  ) : (
                    (companyTags ?? [])
                      .filter((t) => !folderTagIds.includes(t.id))
                      .map((tag) => (
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
            </div>
            {folderTagIds.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Only users sharing at least one of these tags can see this folder.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-folder-name">Name</Label>
              <Input
                id="edit-folder-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-folder-desc">Description</Label>
              <Input
                id="edit-folder-desc"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <div className="flex gap-2">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setEditForm((f) => ({ ...f, visibility: opt.value }))
                    }
                    className={cn(
                      "flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors",
                      editForm.visibility === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                updateMutation.mutate({
                  name: editForm.name,
                  description: editForm.description || undefined,
                  visibility: editForm.visibility,
                })
              }
              disabled={!editForm.name.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete "{folder.name}"? This will remove the folder
            and unlink all items. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item dialog */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Item type selector */}
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="flex gap-2">
                {([
                  { value: "document" as const, label: "Document", icon: FileText },
                  { value: "artifact" as const, label: "Artifact", icon: Code2 },
                  { value: "channel" as const, label: "Chat Link", icon: MessageSquare },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setAddItemType(opt.value);
                      setSelectedItemId(null);
                    }}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-medium transition-colors",
                      addItemType === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <opt.icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Item list */}
            <div className="space-y-1.5">
              <Label>Select an item</Label>
              <div className="max-h-60 overflow-auto rounded-md border divide-y">
                {addItemType === "document" && (
                  <>
                    {documentsQuery.isLoading && (
                      <p className="text-xs text-muted-foreground p-3">Loading documents...</p>
                    )}
                    {(documentsQuery.data?.documents ?? []).length === 0 && !documentsQuery.isLoading && (
                      <p className="text-xs text-muted-foreground p-3">No documents found.</p>
                    )}
                    {(documentsQuery.data?.documents ?? []).map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setSelectedItemId(doc.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between",
                          selectedItemId === doc.id && "bg-primary/5",
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{doc.title}</span>
                        </div>
                        {selectedItemId === doc.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    ))}
                  </>
                )}

                {addItemType === "artifact" && (
                  <>
                    {artifactsQuery.isLoading && (
                      <p className="text-xs text-muted-foreground p-3">Loading artifacts...</p>
                    )}
                    {(artifactsQuery.data?.artifacts ?? []).length === 0 && !artifactsQuery.isLoading && (
                      <p className="text-xs text-muted-foreground p-3">No artifacts found.</p>
                    )}
                    {(artifactsQuery.data?.artifacts ?? []).map((artifact) => (
                      <button
                        key={artifact.id}
                        type="button"
                        onClick={() => setSelectedItemId(artifact.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between",
                          selectedItemId === artifact.id && "bg-primary/5",
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Code2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{artifact.title}</span>
                        </div>
                        {selectedItemId === artifact.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    ))}
                  </>
                )}

                {addItemType === "channel" && (
                  <>
                    {channelsQuery.isLoading && (
                      <p className="text-xs text-muted-foreground p-3">Loading channels...</p>
                    )}
                    {(channelsQuery.data?.channels ?? []).length === 0 && !channelsQuery.isLoading && (
                      <p className="text-xs text-muted-foreground p-3">No channels found.</p>
                    )}
                    {(channelsQuery.data?.channels ?? []).map((channel) => (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => setSelectedItemId(channel.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between",
                          selectedItemId === channel.id && "bg-primary/5",
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{channel.name ?? `Channel ${channel.id.slice(0, 8)}`}</span>
                        </div>
                        {selectedItemId === channel.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedItemId) return;
                addItemMutation.mutate({
                  itemType: addItemType,
                  ...(addItemType === "document" && { documentId: selectedItemId }),
                  ...(addItemType === "artifact" && { artifactId: selectedItemId }),
                  ...(addItemType === "channel" && { channelId: selectedItemId }),
                });
              }}
              disabled={!selectedItemId || addItemMutation.isPending}
            >
              {addItemMutation.isPending ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
