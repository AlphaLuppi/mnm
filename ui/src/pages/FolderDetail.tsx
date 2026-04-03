import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Folder as FolderIcon,
  Lock,
  Users,
  Pencil,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { useParams, useNavigate } from "../lib/router";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { foldersApi } from "../api/folders";
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
import { cn } from "../lib/utils";
import type { FolderVisibility } from "@mnm/shared";

const VISIBILITY_OPTIONS: { value: FolderVisibility; label: string }[] = [
  { value: "private", label: "Private" },
  { value: "team", label: "Team" },
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
                <Users className="h-4 w-4 text-blue-500" />
              )}
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  folder.visibility === "public" &&
                    "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
                  folder.visibility === "team" &&
                    "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
                  folder.visibility === "private" && "bg-muted text-muted-foreground",
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
        </div>
        <FolderItemList
          items={folder.items ?? []}
          onRemove={(itemId) => removeItemMutation.mutate(itemId)}
          removing={removingItemId}
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
    </div>
  );
}
