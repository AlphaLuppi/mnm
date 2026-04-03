import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Folder as FolderIcon,
  Pencil,
  Trash2,
  ArrowLeft,
  Plus,
  FileText,
  Code2,
  MessageSquare,
  Check,
  Upload,
} from "lucide-react";
import { useParams, useNavigate } from "../lib/router";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { foldersApi } from "../api/folders";
import { documentsApi } from "../api/documents";
import { artifactsApi } from "../api/artifacts";
import { chatApi } from "../api/chat";
import { queryKeys } from "../lib/queryKeys";
import { FolderItemList } from "../components/folders/FolderItemList";
import { FolderShareManager } from "../components/folders/FolderShareManager";
import { FolderDeleteDialog } from "../components/folders/FolderDeleteDialog";
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
import { cn } from "../lib/utils";
import type { FolderItemType } from "@mnm/shared";

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
  }>({ name: "", description: "" });
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemType, setAddItemType] = useState<FolderItemType>("document");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");

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

  useEffect(() => {
    if (folder) {
      setEditForm({
        name: folder.name,
        description: folder.description ?? "",
      });
      setInstructions(folder.instructions ?? "");
    }
  }, [folder]);

  const canEdit = folder?.canEdit ?? false;

  const updateMutation = useMutation({
    mutationFn: (input: { name?: string; description?: string; instructions?: string | null }) =>
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
    mutationFn: (preserveDocumentIds: string[]) =>
      foldersApi.delete(selectedCompanyId!, folderId!, preserveDocumentIds),
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

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      foldersApi.upload(selectedCompanyId!, folderId!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.detail(selectedCompanyId!, folderId!),
      });
    },
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

  const saveInstructions = useCallback(() => {
    const value = instructions.trim() || null;
    if (value !== (folder?.instructions ?? null)) {
      updateMutation.mutate({ instructions: value });
    }
  }, [instructions, folder?.instructions, updateMutation]);

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
    mutationFn: (input: {
      itemType: FolderItemType;
      artifactId?: string;
      documentId?: string;
      channelId?: string;
    }) => foldersApi.addItem(selectedCompanyId!, folderId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.detail(selectedCompanyId!, folderId!),
      });
      setAddItemOpen(false);
      setSelectedItemId(null);
    },
  });

  // Get conversations in this folder
  const folderChannels =
    folder?.items.filter((item) => item.itemType === "channel") ?? [];

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
      <Button
        variant="ghost"
        size="sm"
        className="gap-1"
        onClick={() => navigate("/folders")}
      >
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
            <h1 className="text-xl font-bold">{folder.name}</h1>
            {folder.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {folder.description}
              </p>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Edit folder"
              onClick={() => setEditOpen(true)}
            >
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
        )}
      </div>

      {/* Instructions */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Instructions</h2>
        <p className="text-xs text-muted-foreground">
          Markdown injected into every chat in this folder.
        </p>
        <textarea
          className="w-full min-h-[100px] rounded-md border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Write instructions for conversations in this folder..."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          onBlur={saveInstructions}
          readOnly={!canEdit}
        />
      </div>

      {/* Upload zone */}
      {canEdit && (
        <div
          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/40 transition-colors"
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
          <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drop files here or click to upload
          </p>
          {uploadMutation.isPending && (
            <p className="text-xs text-muted-foreground mt-1">Uploading...</p>
          )}
        </div>
      )}

      {/* Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">
            Items{" "}
            {folder.items && (
              <span className="text-muted-foreground">
                ({folder.items.length})
              </span>
            )}
          </h2>
          {canEdit && (
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
              Import Item
            </Button>
          )}
        </div>
        <FolderItemList
          items={folder.items ?? []}
          onRemove={(itemId) => removeItemMutation.mutate(itemId)}
          removing={removingItemId}
        />
      </div>

      {/* Conversations */}
      {folderChannels.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium">
            Conversations{" "}
            <span className="text-muted-foreground">
              ({folderChannels.length})
            </span>
          </h2>
          <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
            {folderChannels.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-center gap-3"
                onClick={() =>
                  navigate(`/folders/${folderId}/chat/${item.channelId}`)
                }
              >
                <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">
                  {item.displayName ?? item.channelId?.slice(0, 12)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sharing */}
      <div className="border border-border rounded-lg p-4">
        <FolderShareManager
          companyId={selectedCompanyId!}
          folderId={folderId!}
          shares={folder.shares ?? []}
          folderTags={folder.tags ?? []}
          canEdit={canEdit}
        />
      </div>

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
                })
              }
              disabled={!editForm.name.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Smart delete dialog */}
      <FolderDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        companyId={selectedCompanyId!}
        folderId={folderId!}
        folderName={folder.name}
        onConfirm={(preserveIds) => deleteMutation.mutate(preserveIds)}
        isPending={deleteMutation.isPending}
      />

      {/* Add Item dialog */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="flex gap-2">
                {(
                  [
                    {
                      value: "document" as const,
                      label: "Document",
                      icon: FileText,
                    },
                    {
                      value: "artifact" as const,
                      label: "Artifact",
                      icon: Code2,
                    },
                    {
                      value: "channel" as const,
                      label: "Chat Link",
                      icon: MessageSquare,
                    },
                  ] as const
                ).map((opt) => (
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

            <div className="space-y-1.5">
              <Label>Select an item</Label>
              <div className="max-h-60 overflow-auto rounded-md border divide-y">
                {addItemType === "document" && (
                  <>
                    {documentsQuery.isLoading && (
                      <p className="text-xs text-muted-foreground p-3">
                        Loading documents...
                      </p>
                    )}
                    {(documentsQuery.data?.documents ?? []).length === 0 &&
                      !documentsQuery.isLoading && (
                        <p className="text-xs text-muted-foreground p-3">
                          No documents found.
                        </p>
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
                        {selectedItemId === doc.id && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </>
                )}

                {addItemType === "artifact" && (
                  <>
                    {artifactsQuery.isLoading && (
                      <p className="text-xs text-muted-foreground p-3">
                        Loading artifacts...
                      </p>
                    )}
                    {(artifactsQuery.data?.artifacts ?? []).length === 0 &&
                      !artifactsQuery.isLoading && (
                        <p className="text-xs text-muted-foreground p-3">
                          No artifacts found.
                        </p>
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
                        {selectedItemId === artifact.id && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </>
                )}

                {addItemType === "channel" && (
                  <>
                    {channelsQuery.isLoading && (
                      <p className="text-xs text-muted-foreground p-3">
                        Loading channels...
                      </p>
                    )}
                    {(channelsQuery.data?.channels ?? []).length === 0 &&
                      !channelsQuery.isLoading && (
                        <p className="text-xs text-muted-foreground p-3">
                          No channels found.
                        </p>
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
                          <span className="truncate">
                            {channel.name ??
                              `Channel ${channel.id.slice(0, 8)}`}
                          </span>
                        </div>
                        {selectedItemId === channel.id && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
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
                  ...(addItemType === "document" && {
                    documentId: selectedItemId,
                  }),
                  ...(addItemType === "artifact" && {
                    artifactId: selectedItemId,
                  }),
                  ...(addItemType === "channel" && {
                    channelId: selectedItemId,
                  }),
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
