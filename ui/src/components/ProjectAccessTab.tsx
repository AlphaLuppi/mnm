import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, UserPlus, Search, MoreHorizontal } from "lucide-react";
import { PROJECT_MEMBERSHIP_ROLES, type ProjectMembershipRole } from "@mnm/shared";
import { projectMembershipsApi, type ProjectMember } from "../api/project-memberships";
import { queryKeys } from "../lib/queryKeys";
import { relativeTime, cn } from "../lib/utils";
import { EmptyState } from "./EmptyState";
import { AddProjectMemberDialog } from "./AddProjectMemberDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PROJECT_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  contributor: "Contributor",
  viewer: "Viewer",
};

const PROJECT_ROLE_COLORS: Record<string, string> = {
  owner: "text-amber-600 bg-amber-50 border-amber-200",
  manager: "text-blue-600 bg-blue-50 border-blue-200",
  contributor: "text-green-600 bg-green-50 border-green-200",
  viewer: "text-gray-600 bg-gray-50 border-gray-200",
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface ProjectAccessTabProps {
  projectId: string;
  companyId: string;
}

export function ProjectAccessTab({ projectId, companyId }: ProjectAccessTabProps) {
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    userId: string;
    userName: string | null;
  } | null>(null);

  const {
    data: members,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.projectMemberships.list(companyId, projectId),
    queryFn: () => projectMembershipsApi.listMembers(companyId, projectId),
    enabled: !!companyId && !!projectId,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: ProjectMembershipRole;
    }) => projectMembershipsApi.updateMemberRole(companyId, projectId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectMemberships.list(companyId, projectId),
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      projectMembershipsApi.removeMember(companyId, projectId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectMemberships.list(companyId, projectId),
      });
      setRemoveTarget(null);
    },
  });

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    return members.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (m.userName ?? "").toLowerCase();
        const email = (m.userEmail ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [members, roleFilter, searchQuery]);

  const existingMemberIds = useMemo(
    () => (members ?? []).map((m) => m.userId),
    [members],
  );

  if (isLoading) {
    return (
      <div data-testid="proj-s04-access-tab" className="space-y-4">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-10 bg-muted rounded" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="proj-s04-access-tab" className="p-4 text-sm text-destructive">
        Failed to load project members:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div data-testid="proj-s04-access-tab" className="space-y-4">
      {/* Header */}
      <div
        data-testid="proj-s04-header"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <h2 data-testid="proj-s04-title" className="text-lg font-semibold">
          Project Access
        </h2>
        <Button
          data-testid="proj-s04-add-member-button"
          onClick={() => setAddDialogOpen(true)}
        >
          <UserPlus className="h-4 w-4 mr-1.5" />
          Add Member
        </Button>
      </div>

      {/* Filters */}
      <div data-testid="proj-s04-filters" className="flex flex-wrap items-center gap-2">
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger
            data-testid="proj-s04-filter-role"
            size="sm"
            className="w-[140px]"
          >
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem data-testid="proj-s04-filter-role-all" value="all">
              All roles
            </SelectItem>
            {PROJECT_MEMBERSHIP_ROLES.map((role) => (
              <SelectItem
                key={role}
                data-testid={`proj-s04-filter-role-${role}`}
                value={role}
              >
                {PROJECT_ROLE_LABELS[role] ?? role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="proj-s04-search"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
      </div>

      {/* Table or Empty State */}
      {!members || members.length === 0 ? (
        <div data-testid="proj-s04-empty-state">
          <EmptyState
            icon={Users}
            message="No members yet. Add someone to get started."
            action="Add Member"
            onAction={() => setAddDialogOpen(true)}
          />
        </div>
      ) : filteredMembers.length === 0 ? (
        <div
          data-testid="proj-s04-no-results"
          className="py-12 text-center text-sm text-muted-foreground"
        >
          No members match your filters.
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <table
            data-testid="proj-s04-members-table"
            className="w-full text-sm"
          >
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Member
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                  Role
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">
                  Added
                </th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr
                  key={member.userId}
                  data-testid={`proj-s04-member-row-${member.userId}`}
                  className="border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors"
                >
                  {/* Member info */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {member.userImage && (
                          <AvatarImage
                            src={member.userImage}
                            alt={member.userName ?? ""}
                          />
                        )}
                        <AvatarFallback className="text-xs">
                          {getInitials(member.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div
                          data-testid={`proj-s04-member-name-${member.userId}`}
                          className="font-medium truncate"
                        >
                          {member.userName ?? member.userId}
                        </div>
                        {member.userEmail && (
                          <div
                            data-testid={`proj-s04-member-email-${member.userId}`}
                            className="text-xs text-muted-foreground truncate"
                          >
                            {member.userEmail}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-2.5 hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <Badge
                        data-testid={`proj-s04-member-role-badge-${member.userId}`}
                        variant="outline"
                        className={cn(PROJECT_ROLE_COLORS[member.role])}
                      >
                        {PROJECT_ROLE_LABELS[member.role] ?? member.role}
                      </Badge>
                      <Select
                        value={member.role}
                        onValueChange={(val) =>
                          updateRoleMutation.mutate({
                            userId: member.userId,
                            role: val as ProjectMembershipRole,
                          })
                        }
                      >
                        <SelectTrigger
                          data-testid={`proj-s04-member-role-select-${member.userId}`}
                          size="sm"
                          className="w-[120px] h-7 text-xs"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROJECT_MEMBERSHIP_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {PROJECT_ROLE_LABELS[r] ?? r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </td>

                  {/* Date added */}
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                    <span data-testid={`proj-s04-member-date-${member.userId}`}>
                      {relativeTime(member.createdAt)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-2.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          data-testid={`proj-s04-member-actions-${member.userId}`}
                          variant="ghost"
                          size="icon-sm"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          data-testid={`proj-s04-action-remove-${member.userId}`}
                          onClick={() =>
                            setRemoveTarget({
                              userId: member.userId,
                              userName: member.userName,
                            })
                          }
                          className="text-destructive"
                        >
                          Remove from project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div data-testid="proj-s04-footer" className="text-xs text-muted-foreground">
        <span data-testid="proj-s04-member-count">
          Showing {filteredMembers.length} of {members?.length ?? 0} members
        </span>
      </div>

      {/* Add Member Dialog */}
      <AddProjectMemberDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        companyId={companyId}
        projectId={projectId}
        existingMemberIds={existingMemberIds}
      />

      {/* Remove Confirmation Dialog */}
      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <DialogContent data-testid="proj-s04-remove-confirm-dialog">
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription data-testid="proj-s04-remove-confirm-message">
              Remove {removeTarget?.userName ?? "this member"} from this project?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              data-testid="proj-s04-remove-confirm-cancel"
              variant="outline"
              onClick={() => setRemoveTarget(null)}
            >
              Cancel
            </Button>
            <Button
              data-testid="proj-s04-remove-confirm-submit"
              variant="destructive"
              onClick={() => {
                if (removeTarget) {
                  removeMemberMutation.mutate(removeTarget.userId);
                }
              }}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
