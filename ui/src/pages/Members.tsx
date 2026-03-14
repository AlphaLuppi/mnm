import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, UserPlus, Search, MoreHorizontal } from "lucide-react";
import { BUSINESS_ROLES, type BusinessRole } from "@mnm/shared";
import { accessApi, type EnrichedMember } from "../api/access";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { relativeTime, cn } from "../lib/utils";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
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
import { Label } from "@/components/ui/label";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  contributor: "Contributor",
  viewer: "Viewer",
};

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
    queryKey: queryKeys.members(selectedCompanyId!),
    queryFn: () => accessApi.listMembers(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      memberId,
      businessRole,
    }: {
      memberId: string;
      businessRole: BusinessRole;
    }) =>
      accessApi.updateMemberBusinessRole(
        selectedCompanyId!,
        memberId,
        businessRole,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.members(selectedCompanyId!),
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
        queryKey: queryKeys.members(selectedCompanyId!),
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
        queryKey: queryKeys.members(selectedCompanyId!),
      });
    },
  });

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    return members.filter((m) => {
      if (roleFilter !== "all" && m.businessRole !== roleFilter) return false;
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
    <div data-testid="mu-s02-members-page" className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={roleFilter}
          onValueChange={setRoleFilter}
        >
          <SelectTrigger
            data-testid="mu-s02-role-filter"
            size="sm"
            className="w-[140px]"
          >
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {BUSINESS_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABELS[role] ?? role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
        >
          <SelectTrigger
            data-testid="mu-s02-status-filter"
            size="sm"
            className="w-[140px]"
          >
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="mu-s02-search-input"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
      </div>

      {/* Table */}
      {!members || members.length === 0 ? (
        <EmptyState
          icon={Users}
          message="No members yet. Invite someone to get started."
          action="Invite Member"
          onAction={() => setInviteOpen(true)}
        />
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
                  onRoleChange={(role) =>
                    updateRoleMutation.mutate({
                      memberId: member.id,
                      businessRole: role,
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
        data-testid="mu-s02-member-count"
        className="text-xs text-muted-foreground"
      >
        {filteredMembers.length} of {members?.length ?? 0} member
        {(members?.length ?? 0) !== 1 ? "s" : ""}
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent data-testid="mu-s02-invite-dialog">
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Send an invitation email to add a new member to this company.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              data-testid="mu-s02-invite-email-input"
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
          <DialogFooter>
            <Button
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
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberRow({
  member,
  onRoleChange,
  onStatusChange,
}: {
  member: EnrichedMember;
  onRoleChange: (role: BusinessRole) => void;
  onStatusChange: (status: "active" | "suspended") => void;
}) {
  const displayName = member.userName ?? member.principalId;
  const displayEmail = member.userEmail ?? null;
  const isSuspended = member.status === "suspended";

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
        <Select
          value={member.businessRole}
          onValueChange={(val) => onRoleChange(val as BusinessRole)}
        >
          <SelectTrigger
            data-testid={`mu-s02-role-select-${member.id}`}
            size="sm"
            className="w-[120px] h-7 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUSINESS_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABELS[role] ?? role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Status */}
      <td className="px-4 py-2.5 hidden md:table-cell">
        <Badge
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
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {member.status === "active" ? (
              <DropdownMenuItem
                onClick={() => onStatusChange("suspended")}
                className="text-destructive"
              >
                Suspend
              </DropdownMenuItem>
            ) : member.status === "suspended" ? (
              <DropdownMenuItem onClick={() => onStatusChange("active")}>
                Reactivate
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
