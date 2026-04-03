import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Folder as FolderIcon } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useNavigate } from "../lib/router";
import { foldersApi } from "../api/folders";
import { queryKeys } from "../lib/queryKeys";
import { FolderCard } from "../components/folders/FolderCard";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Folders() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{
    name: string;
    description: string;
  }>({
    name: "",
    description: "",
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Folders" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.folders.list(selectedCompanyId!),
    queryFn: () => foldersApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const folders = data?.folders ?? [];

  const createMutation = useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      foldersApi.create(selectedCompanyId!, input),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.list(selectedCompanyId!),
      });
      setCreateOpen(false);
      setCreateForm({ name: "", description: "" });
      navigate(`/folders/${created.id}`);
    },
  });

  if (isLoading) return <PageSkeleton variant="list" />;
  if (error)
    return (
      <p className="text-sm text-destructive">Failed to load folders.</p>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Folders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organize documents, artifacts, and chats into workspaces.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          New Folder
        </Button>
      </div>

      {/* Folder grid */}
      {folders.length === 0 ? (
        <EmptyState
          icon={FolderIcon}
          message="Create a folder to start organizing your documents, artifacts, and chats."
          action="New Folder"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onClick={() => navigate(`/folders/${folder.id}`)}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="folder-name">Name</Label>
              <Input
                id="folder-name"
                placeholder="e.g. Sprint Docs"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="folder-desc">Description (optional)</Label>
              <Input
                id="folder-desc"
                placeholder="What is this folder for?"
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  name: createForm.name,
                  description: createForm.description || undefined,
                })
              }
              disabled={!createForm.name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
