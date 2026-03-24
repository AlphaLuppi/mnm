import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, UserPlus, Search, MoreHorizontal } from "lucide-react";
import { accessApi, type EnrichedMember } from "../api/access";
import { rolesApi, type Role } from "../api/roles";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { relativeTime, cn } from "../lib/utils";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { BulkInviteTab } from "../components/BulkInviteTab";
import { RoleBadge } from "../components/RoleBadge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  suspended: "Suspended",
  pending: "Pending",
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

export function Members() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: "Members" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const {
    data: members,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.access.members(selectedCompanyId!),
    queryFn: () => accessApi.listMembers(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Fetch dynamic roles list
  const { data: roles } = useQuery({
    queryKey: queryKeys.roles.list(selectedCompanyId!),
    queryFn: () => rolesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Build a roleId -> Role map for display
  const roleMap = useMemo(() => {
    const map = new Map<string, Role>();
    if (roles) {
      for (const role of roles) {
        map.set(role.id, role);
        // Also index by slug for backward compat with businessRole field
        map.set(role.slug, role);
      }
    }
    return map;
  }, [roles]);

  function getRoleName(member: EnrichedMember): string {
    // Try to resolve via roleMap (by roleId or businessRole slug)
    const roleKey = member.roleId ?? member.businessRole;
    if (roleKey) {
      const role = roleMap.get(roleKey);
      if (role) return role.name;
      return roleKey.charAt(0).toUpperCase() + roleKey.slice(1);
    }
    return "Unknown";
  }

  const updateRoleMutation = useMutation({
    mutationFn: ({
      memberId,
      roleId,
    }: {
      memberId: string;
      roleId: string;
    }) =>
      accessApi.updateMemberRole(
        selectedCompanyId!,
        memberId,
        roleId,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.access.members(selectedCompanyId!),
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      memberId,
      status,
    }: {
      memberId: string;
      status: "active" | "suspended";
    }) => accessApi.updateMemberStatus(selectedCompanyId!, memberId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.access.members(selectedCompanyId!),
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (email: string) =>
      accessApi.createEmailInvite(selectedCompanyId!, email),
    onSuccess: () => {
      setInviteOpen(false);
      setInviteEmail("");
      queryClient.invalidateQueries({
        queryKey: queryKeys.access.members(selectedCompanyId!),
      });
    },
  });

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    return members.filter((m) => {
      if (roleFilter !== "all" && (m.roleId ?? m.businessRole) !== roleFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (m.userName ?? "").toLowerCase();
        const email = (m.userEmail ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [members, roleFilter, statusFilter, searchQuery]);

  if (isLoading) return <PageSkeleton variant="list" />;

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        Failed to load members:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div data-testid="mu-s02-page" className="space-y-4">
      {/* Header */}
      <div data-testid="mu-s02-header" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold">Members</h1>
        <Button
          data-testid="mu-s02-invite-button"
          onClick={() => setInviteOpen(true)}
        >
          <UserPlus className="h-4 w-4 mr-1.5" />
          Invite Member
        </Button>
      </div>

      {/* Filters */}
      <div data-testid="mu-s02-filters" className="flex flex-wrap items-center gap-2">
        <Select
          value={roleFilter}
          onValueChange={setRoleFilter}
        >
          <SelectTrigger
            data-testid="mu-s02-filter-role"
            size="sm"
            className="w-[140px]"
          >
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem data-testid="mu-s02-filter-role-all" value="all">All roles</SelectItem>
            {(roles ?? []).map((role) => (
              <SelectItem key={role.id} value={role.slug}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
        >
          <SelectTrigger
            data-testid="mu-s02-filter-status"
            size="sm"
            className="w-[140px]"
          >
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem data-testid="mu-s02-filter-status-all" value="all">All statuses</SelectItem>
            <SelectItem data-testid="mu-s02-filter-status-active" value="active">Active</SelectItem>
            <SelectItem data-testid="mu-s02-filter-status-suspended" value="suspended">Suspended</SelectItem>
            <SelectItem data-testid="mu-s02-filter-status-pending" value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="mu-s02-search"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
      </div>

      {/* Table */}
      {!members || members.length === 0 ? (
        <div data-testid="mu-s02-empty-state">
          <EmptyState
            icon={Users}
            message="No members yet. Invite someone to get started."
            action="Invite Member"
            onAction={() => setInviteOpen(true)}
          />
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No members match your filters.
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <table
            data-testid="mu-s02-members-table"
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
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                  Status
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">
                  Joined
                </th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  roles={roles ?? []}
                  getRoleName={getRoleName}
                  onRoleChange={(roleId) =>
                    updateRoleMutation.mutate({
                      memberId: member.id,
                      roleId,
                    })
                  }
                  onStatusChange={(status) =>
                    updateStatusMutation.mutate({
                      memberId: member.id,
                      status,
                    })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer with member count */}
      <div
        data-testid="mu-s02-footer"
        className="text-xs text-muted-foreground"
      >
        <span data-testid="mu-s02-member-count">
          Showing {filteredMembers.length} of {members?.length ?? 0} members
        </span>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => {
        setInviteOpen(open);
        if (!open) setInviteEmail("");
      }}>
        <DialogContent data-testid="mu-s02-invite-dialog" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite Members</DialogTitle>
            <DialogDescription>
              Invite new members by email or upload a CSV file for bulk import.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="single" data-testid="mu-s03-invite-tabs">
            <TabsList className="w-full" data-testid="mu-s03-tabs-list">
              <TabsTrigger value="single" data-testid="mu-s03-tab-single" className="flex-1">
                Single Invite
              </TabsTrigger>
              <TabsTrigger value="bulk" data-testid="mu-s03-tab-bulk" className="flex-1">
                Bulk Import
              </TabsTrigger>
            </TabsList>
            <TabsContent value="single" data-testid="mu-s03-tab-single-content">
              <div className="space-y-2 pt-2">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  data-testid="mu-s02-invite-email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && inviteEmail.trim()) {
                      inviteMutation.mutate(inviteEmail.trim());
                    }
                  }}
                />
                {inviteMutation.error && (
                  <p className="text-xs text-destructive">
                    {inviteMutation.error instanceof Error
                      ? inviteMutation.error.message
                      : "Failed to send invitation"}
                  </p>
                )}
              </div>
              <DialogFooter className="mt-4">
                <Button
                  data-testid="mu-s02-invite-cancel"
                  variant="outline"
                  onClick={() => {
                    setInviteOpen(false);
                    setInviteEmail("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  data-testid="mu-s02-invite-submit"
                  onClick={() => inviteMutation.mutate(inviteEmail.trim())}
                  disabled={!inviteEmail.trim() || inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
                </Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="bulk" data-testid="mu-s03-tab-bulk-content">
              <div className="pt-2">
                <BulkInviteTab
                  companyId={selectedCompanyId!}
                  onComplete={() => {
                    setInviteOpen(false);
                    queryClient.invalidateQueries({
                      queryKey: queryKeys.access.members(selectedCompanyId!),
                    });
                  }}
                />
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberRow({
  member,
  roles,
  getRoleName,
  onRoleChange,
  onStatusChange,
}: {
  member: EnrichedMember;
  roles: Role[];
  getRoleName: (member: EnrichedMember) => string;
  onRoleChange: (roleId: string) => void;
  onStatusChange: (status: "active" | "suspended") => void;
}) {
  const displayName = member.userName ?? member.principalId;
  const displayEmail = member.userEmail ?? null;
  const isSuspended = member.status === "suspended";
  const roleName = getRoleName(member);

  return (
    <tr
      data-testid={`mu-s02-member-row-${member.id}`}
      className={cn(
        "border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors",
        isSuspended && "opacity-60",
      )}
    >
      {/* Member info */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            {member.userImage && (
              <AvatarImage src={member.userImage} alt={displayName} />
            )}
            <AvatarFallback>{getInitials(member.userName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div
              data-testid={`mu-s02-member-name-${member.id}`}
              className="font-medium truncate"
            >
              {displayName}
            </div>
            {displayEmail && (
              <div
                data-testid={`mu-s02-member-email-${member.id}`}
                className="text-xs text-muted-foreground truncate"
              >
                {displayEmail}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="px-4 py-2.5 hidden sm:table-cell">
        <div className="flex items-center gap-2">
          <RoleBadge role={(member.roleId ?? member.businessRole ?? "unknown") as string} />
          <Select
            value={member.roleId ?? member.businessRole ?? ""}
            onValueChange={(val) => onRoleChange(val)}
          >
            <SelectTrigger
              data-testid={`mu-s02-member-role-${member.id}`}
              size="sm"
              className="w-[120px] h-7 text-xs"
            >
              <SelectValue>{roleName}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-2.5 hidden md:table-cell">
        <Badge
          data-testid={`mu-s02-member-status-${member.id}`}
          variant={
            member.status === "active"
              ? "secondary"
              : member.status === "suspended"
                ? "destructive"
                : "outline"
          }
        >
          {STATUS_LABELS[member.status] ?? member.status}
        </Badge>
      </td>

      {/* Joined */}
      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
        {relativeTime(member.createdAt)}
      </td>

      {/* Actions */}
      <td className="px-4 py-2.5 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button data-testid={`mu-s02-member-actions-${member.id}`} variant="ghost" size="icon-sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {member.status === "active" ? (
              <DropdownMenuItem
                data-testid={`mu-s02-action-suspend-${member.id}`}
                onClick={() => onStatusChange("suspended")}
                className="text-destructive"
              >
                Suspend
              </DropdownMenuItem>
            ) : member.status === "suspended" ? (
              <DropdownMenuItem
                data-testid={`mu-s02-action-reactivate-${member.id}`}
                onClick={() => onStatusChange("active")}
              >
                Reactivate
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
