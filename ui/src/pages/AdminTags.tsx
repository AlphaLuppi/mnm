import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tag as TagIcon, Plus, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { tagsApi, type Tag, type CreateTagInput } from "../api/tags";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TAG_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

type TagFormData = {
  name: string;
  slug: string;
  description: string;
  color: string;
};

const emptyForm: TagFormData = {
  name: "",
  slug: "",
  description: "",
  color: TAG_COLORS[5],
};

export function AdminTags() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [formData, setFormData] = useState<TagFormData>(emptyForm);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Admin" }, { label: "Tags" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const {
    data: tags,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.tags.list(selectedCompanyId!, showArchived),
    queryFn: () => tagsApi.list(selectedCompanyId!, showArchived),
    enabled: !!selectedCompanyId,
  });

  const activeTags = useMemo(
    () => (tags ?? []).filter((t) => !t.archivedAt),
    [tags],
  );
  const archivedTags = useMemo(
    () => (tags ?? []).filter((t) => !!t.archivedAt),
    [tags],
  );

  const createMutation = useMutation({
    mutationFn: (input: CreateTagInput) =>
      tagsApi.create(selectedCompanyId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tags.list(selectedCompanyId!, showArchived),
      });
      setCreateOpen(false);
      setFormData(emptyForm);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (tagId: string) =>
      tagsApi.archive(selectedCompanyId!, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tags.list(selectedCompanyId!, showArchived),
      });
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: (tagId: string) =>
      tagsApi.unarchive(selectedCompanyId!, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tags.list(selectedCompanyId!, showArchived),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tagId: string) =>
      tagsApi.delete(selectedCompanyId!, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tags.list(selectedCompanyId!, showArchived),
      });
      setDeleteTarget(null);
    },
  });

  function openCreate() {
    setFormData(emptyForm);
    setCreateOpen(true);
  }

  function handleSubmitCreate() {
    createMutation.mutate({
      name: formData.name.trim(),
      slug: formData.slug.trim(),
      description: formData.description.trim() || undefined,
      color: formData.color || undefined,
    });
  }

  function handleSlugFromName(name: string) {
    setFormData((prev) => ({
      ...prev,
      name,
      slug:
        prev.slug ||
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
    }));
  }

  if (isLoading) return <PageSkeleton variant="list" />;

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        Failed to load tags:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold">Tags</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label className="text-sm text-muted-foreground cursor-pointer">
              Show archived
            </Label>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create Tag
          </Button>
        </div>
      </div>

      {/* Tag list */}
      {activeTags.length === 0 && archivedTags.length === 0 ? (
        <EmptyState
          icon={TagIcon}
          message="No tags defined yet. Create one to organize your team."
          action="Create Tag"
          onAction={openCreate}
        />
      ) : (
        <>
          {/* Active tags */}
          {activeTags.length > 0 && (
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Tag
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                      Slug
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                      Members
                    </th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeTags.map((tag) => (
                    <TagRow
                      key={tag.id}
                      tag={tag}
                      onArchive={() => archiveMutation.mutate(tag.id)}
                      onDelete={() => setDeleteTarget(tag)}
                      archiving={archiveMutation.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Archived tags */}
          {showArchived && archivedTags.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">
                Archived ({archivedTags.length})
              </h2>
              <div className="border border-border rounded-md overflow-hidden opacity-70">
                <table className="w-full text-sm">
                  <tbody>
                    {archivedTags.map((tag) => (
                      <TagRow
                        key={tag.id}
                        tag={tag}
                        onUnarchive={() => unarchiveMutation.mutate(tag.id)}
                        onDelete={() => setDeleteTarget(tag)}
                        archiving={unarchiveMutation.isPending}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div className="text-xs text-muted-foreground">
        {activeTags.length} active tag{activeTags.length !== 1 ? "s" : ""}
        {showArchived && archivedTags.length > 0 &&
          `, ${archivedTags.length} archived`}
      </div>

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setFormData(emptyForm);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
            <DialogDescription>
              Tags are used to organize members and agents into groups for
              scoped access control.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                placeholder="e.g. Backend Team"
                value={formData.name}
                onChange={(e) => handleSlugFromName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tag-slug">Slug</Label>
              <Input
                id="tag-slug"
                placeholder="e.g. backend-team"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, slug: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="tag-desc">Description</Label>
              <Textarea
                id="tag-desc"
                placeholder="Optional description..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="w-7 h-7 rounded-full border-2 transition-transform"
                    style={{
                      backgroundColor: c,
                      borderColor:
                        formData.color === c ? "white" : "transparent",
                      transform:
                        formData.color === c ? "scale(1.15)" : "scale(1)",
                    }}
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, color: c }))
                    }
                  />
                ))}
              </div>
            </div>
          </div>
          {createMutation.error && (
            <p className="text-xs text-destructive">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Failed to create tag"}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setFormData(emptyForm);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitCreate}
              disabled={
                !formData.name.trim() ||
                !formData.slug.trim() ||
                createMutation.isPending
              }
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription>
              {deleteTarget && deleteTarget.memberCount > 0
                ? `Cannot delete "${deleteTarget.name}" because it has ${deleteTarget.memberCount} member(s). Archive it instead.`
                : `Are you sure you want to delete the tag "${deleteTarget?.name}"? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.error && (
            <p className="text-xs text-destructive">
              {deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : "Failed to delete tag"}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              disabled={
                !deleteTarget ||
                deleteTarget.memberCount > 0 ||
                deleteMutation.isPending
              }
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TagRow({
  tag,
  onArchive,
  onUnarchive,
  onDelete,
  archiving,
}: {
  tag: Tag;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete: () => void;
  archiving: boolean;
}) {
  const isArchived = !!tag.archivedAt;

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          {tag.color && (
            <span
              className="inline-block w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: tag.color }}
            />
          )}
          <span className="font-medium">{tag.name}</span>
          {isArchived && (
            <Badge variant="outline" className="text-xs">
              Archived
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 hidden sm:table-cell">
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
          {tag.slug}
        </code>
      </td>
      <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">
        {tag.memberCount}
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          {isArchived && onUnarchive ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onUnarchive}
              disabled={archiving}
              title="Unarchive"
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
            </Button>
          ) : onArchive ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onArchive}
              disabled={archiving}
              title="Archive"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            disabled={tag.memberCount > 0}
            title={
              tag.memberCount > 0
                ? "Cannot delete tag with members"
                : "Delete tag"
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
