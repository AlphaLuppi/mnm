import { useEffect, useState, type ReactNode } from "react";
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
import { cn } from "../lib/utils";
import type { FolderVisibility } from "@mnm/shared";

const VISIBILITY_OPTIONS: { value: FolderVisibility; label: string }[] = [
  { value: "private", label: "Private" },
  { value: "team", label: "Team" },
  { value: "public", label: "Public" },
];

function VisibilityFilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80",
      )}
    >
      {children}
    </button>
  );
}

export function Folders() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [visibilityFilter, setVisibilityFilter] = useState<FolderVisibility | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{
    name: string;
    description: string;
    visibility: FolderVisibility;
  }>({
    name: "",
    description: "",
    visibility: "private",
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
    queryFn: () =>
      foldersApi.list(selectedCompanyId!, {
        visibility: visibilityFilter,
      }),
    enabled: !!selectedCompanyId,
  });

  const folders = (data?.folders ?? []).filter((f) =>
    visibilityFilter ? f.visibility === visibilityFilter : true,
  );

  const createMutation = useMutation({
    mutationFn: (input: { name: string; description?: string; visibility?: string }) =>
      foldersApi.create(selectedCompanyId!, input),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.list(selectedCompanyId!),
      });
      setCreateOpen(false);
      setCreateForm({ name: "", description: "", visibility: "private" });
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
            Organize documents, artifacts, and chats into folders.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          New Folder
        </Button>
      </div>

      {/* Visibility filter */}
      <div className="flex items-center gap-1.5">
        <VisibilityFilterButton
          active={!visibilityFilter}
          onClick={() => setVisibilityFilter(undefined)}
        >
          All
        </VisibilityFilterButton>
        {VISIBILITY_OPTIONS.map((opt) => (
          <VisibilityFilterButton
            key={opt.value}
            active={visibilityFilter === opt.value}
            onClick={() => setVisibilityFilter(opt.value)}
          >
            {opt.label}
          </VisibilityFilterButton>
        ))}
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
            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <div className="flex gap-2">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setCreateForm((f) => ({ ...f, visibility: opt.value }))
                    }
                    className={cn(
                      "flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors",
                      createForm.visibility === opt.value
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
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  name: createForm.name,
                  description: createForm.description || undefined,
                  visibility: createForm.visibility,
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
