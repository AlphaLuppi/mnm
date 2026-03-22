import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Plus, Pencil, Trash2 } from "lucide-react";
import { rolesApi, type Role, type CreateRoleInput, type UpdateRoleInput } from "../api/roles";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RoleFormData = {
  name: string;
  slug: string;
  description: string;
  hierarchyLevel: string;
};

const emptyForm: RoleFormData = {
  name: "",
  slug: "",
  description: "",
  hierarchyLevel: "100",
};

export default function AdminRoles() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [formData, setFormData] = useState<RoleFormData>(emptyForm);

  useEffect(() => {
    setBreadcrumbs([{ label: "Admin" }, { label: "Roles" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const {
    data: roles,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.roles.list(selectedCompanyId!),
    queryFn: () => rolesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateRoleInput) =>
      rolesApi.create(selectedCompanyId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.roles.list(selectedCompanyId!),
      });
      setCreateOpen(false);
      setFormData(emptyForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ roleId, input }: { roleId: string; input: UpdateRoleInput }) =>
      rolesApi.update(selectedCompanyId!, roleId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.roles.list(selectedCompanyId!),
      });
      setEditTarget(null);
      setFormData(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) =>
      rolesApi.delete(selectedCompanyId!, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.roles.list(selectedCompanyId!),
      });
      setDeleteTarget(null);
    },
  });

  function openCreate() {
    setFormData(emptyForm);
    setCreateOpen(true);
  }

  function openEdit(role: Role) {
    setFormData({
      name: role.name,
      slug: role.slug,
      description: role.description ?? "",
      hierarchyLevel: String(role.hierarchyLevel),
    });
    setEditTarget(role);
  }

  function handleSubmitCreate() {
    const level = parseInt(formData.hierarchyLevel, 10);
    createMutation.mutate({
      name: formData.name.trim(),
      slug: formData.slug.trim(),
      description: formData.description.trim() || undefined,
      hierarchyLevel: isNaN(level) ? 100 : level,
    });
  }

  function handleSubmitEdit() {
    if (!editTarget) return;
    const level = parseInt(formData.hierarchyLevel, 10);
    updateMutation.mutate({
      roleId: editTarget.id,
      input: {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        hierarchyLevel: isNaN(level) ? 100 : level,
      },
    });
  }

  function handleSlugFromName(name: string) {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: prev.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    }));
  }

  if (isLoading) return <PageSkeleton variant="list" />;

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        Failed to load roles:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold">Roles</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Create Role
        </Button>
      </div>

      {/* Table */}
      {!roles || roles.length === 0 ? (
        <EmptyState
          icon={Shield}
          message="No roles defined yet. Create one to get started."
          action="Create Role"
          onAction={openCreate}
        />
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                  Slug
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                  Level
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                  Flags
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">
                  Permissions
                </th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr
                  key={role.id}
                  className="border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{role.name}</div>
                    {role.description && (
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {role.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {role.slug}
                    </code>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">
                    {role.hierarchyLevel}
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {role.isSystem && (
                        <Badge variant="secondary">System</Badge>
                      )}
                      {role.bypassTagFilter && (
                        <Badge variant="outline">Bypass Tags</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell">
                    <Badge variant="outline">
                      {role.permissions?.length ?? 0} permissions
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(role)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={role.isSystem}
                        onClick={() => setDeleteTarget(role)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-muted-foreground">
        {roles?.length ?? 0} role{(roles?.length ?? 0) !== 1 ? "s" : ""}
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
            <DialogTitle>Create Role</DialogTitle>
            <DialogDescription>
              Define a new role with a name, slug, and hierarchy level.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                placeholder="e.g. Team Lead"
                value={formData.name}
                onChange={(e) => handleSlugFromName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="role-slug">Slug</Label>
              <Input
                id="role-slug"
                placeholder="e.g. team-lead"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, slug: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="role-desc">Description</Label>
              <Textarea
                id="role-desc"
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
              <Label htmlFor="role-level">Hierarchy Level</Label>
              <Input
                id="role-level"
                type="number"
                placeholder="100"
                value={formData.hierarchyLevel}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    hierarchyLevel: e.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lower values = higher authority (admin=10, viewer=100)
              </p>
            </div>
          </div>
          {createMutation.error && (
            <p className="text-xs text-destructive">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Failed to create role"}
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

      {/* Edit Dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
            setFormData(emptyForm);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update role details. Slug cannot be changed after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-role-name">Name</Label>
              <Input
                id="edit-role-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={editTarget?.slug ?? ""} disabled />
            </div>
            <div>
              <Label htmlFor="edit-role-desc">Description</Label>
              <Textarea
                id="edit-role-desc"
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
              <Label htmlFor="edit-role-level">Hierarchy Level</Label>
              <Input
                id="edit-role-level"
                type="number"
                value={formData.hierarchyLevel}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    hierarchyLevel: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          {updateMutation.error && (
            <p className="text-xs text-destructive">
              {updateMutation.error instanceof Error
                ? updateMutation.error.message
                : "Failed to update role"}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditTarget(null);
                setFormData(emptyForm);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitEdit}
              disabled={!formData.name.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
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
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the role &quot;{deleteTarget?.name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.error && (
            <p className="text-xs text-destructive">
              {deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : "Failed to delete role"}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
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
