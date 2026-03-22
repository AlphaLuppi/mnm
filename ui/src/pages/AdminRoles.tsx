import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  type string,
  type string,
} from "@mnm/shared";
import { accessApi, type EnrichedMember } from "../api/access";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { RoleBadge } from "../components/RoleBadge";
import { RoleOverviewCard } from "../components/RoleOverviewCard";
import { PermissionMatrix } from "../components/PermissionMatrix";
import { PageSkeleton } from "../components/PageSkeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AdminRoles() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: "Admin" }, { label: "Roles & Permissions" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  // Fetch presets matrix
  const {
    data: presets,
    isLoading: presetsLoading,
    error: presetsError,
  } = useQuery({
    queryKey: queryKeys.access.rbacPresets(selectedCompanyId!),
    queryFn: () => accessApi.getRbacPresets(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 5 * 60 * 1000, // 5 minutes — presets are static
  });

  // Fetch members list
  const {
    data: members,
    isLoading: membersLoading,
    error: membersError,
  } = useQuery({
    queryKey: queryKeys.access.members(selectedCompanyId!),
    queryFn: () => accessApi.listMembers(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Change role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({
      memberId,
      businessRole,
    }: {
      memberId: string;
      businessRole: string;
    }) =>
      accessApi.updateMemberstring(
        selectedCompanyId!,
        memberId,
        businessRole,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.access.members(selectedCompanyId!),
      });
    },
  });

  // Compute member counts per role
  const memberCountsByRole = useMemo(() => {
    const counts: Record<string, number> = {
      admin: 0,
      manager: 0,
      contributor: 0,
      viewer: 0,
    };
    if (members) {
      for (const m of members) {
        const role = m.businessRole as string;
        if (role in counts) {
          counts[role]++;
        }
      }
    }
    return counts;
  }, [members]);

  // Compute permission counts per role from presets
  const permissionCountsByRole = useMemo(() => {
    const counts: Record<string, number> = {
      admin: 0,
      manager: 0,
      contributor: 0,
      viewer: 0,
    };
    if (presets) {
        counts[role] = (presets[role] ?? []).length;
      }
    }
    return counts;
  }, [presets]);

  // Filter members for the Members by Role tab
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    return members.filter((m) => {
      if (roleFilter !== "all" && m.businessRole !== roleFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (m.userName ?? "").toLowerCase();
        const email = (m.userEmail ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [members, roleFilter, searchQuery]);

  const isLoading = presetsLoading || membersLoading;
  const error = presetsError || membersError;

  if (isLoading) {
    return (
      <div data-testid="rbac-s06-loading">
        <PageSkeleton variant="list" />
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="rbac-s06-error" className="p-4 text-sm text-destructive">
        Failed to load roles data:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div data-testid="rbac-s06-page" className="space-y-6">
      {/* Header */}
      <div>
        <h1
          data-testid="rbac-s06-page-title"
          className="text-lg font-semibold"
        >
          Roles & Permissions
        </h1>
        <p
          data-testid="rbac-s06-page-description"
          className="text-sm text-muted-foreground mt-1"
        >
          Manage roles and view the permission matrix for your organization.
        </p>
      </div>

      {/* Tabs */}
      <Tabs data-testid="rbac-s06-tabs" defaultValue="overview">
        <TabsList>
          <TabsTrigger
            data-testid="rbac-s06-tab-overview"
            value="overview"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            data-testid="rbac-s06-tab-matrix"
            value="matrix"
          >
            Permission Matrix
          </TabsTrigger>
          <TabsTrigger
            data-testid="rbac-s06-tab-members"
            value="members"
          >
            Members by Role
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent
          data-testid="rbac-s06-tab-content-overview"
          value="overview"
        >
          <div
            data-testid="rbac-s06-role-cards"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4"
          >
              <RoleOverviewCard
                key={role}
                role={role}
                permissionCount={permissionCountsByRole[role]}
                memberCount={memberCountsByRole[role]}
              />
            ))}
          </div>
        </TabsContent>

        {/* Permission Matrix Tab */}
        <TabsContent
          data-testid="rbac-s06-tab-content-matrix"
          value="matrix"
        >
          <div className="mt-4">
            {presets && <PermissionMatrix presets={presets} />}
          </div>
        </TabsContent>

        {/* Members by Role Tab */}
        <TabsContent
          data-testid="rbac-s06-tab-content-members"
          value="members"
        >
          <div data-testid="rbac-s06-members-section" className="space-y-4 mt-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={roleFilter}
                onValueChange={setRoleFilter}
              >
                <SelectTrigger
                  data-testid="rbac-s06-members-role-filter"
                  size="sm"
                  className="w-[160px]"
                >
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                    <SelectItem key={role} value={role}>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="rbac-s06-members-search"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8"
                />
              </div>

              <span
                data-testid="rbac-s06-members-count"
                className="text-xs text-muted-foreground ml-auto"
              >
                {filteredMembers.length} {filteredMembers.length === 1 ? "member" : "members"}
              </span>
            </div>

            {/* Members Table */}
            {filteredMembers.length === 0 ? (
              <div
                data-testid="rbac-s06-members-empty"
                className="py-12 text-center text-sm text-muted-foreground"
              >
                No members with this role
              </div>
            ) : (
              <div className="border border-border rounded-md overflow-hidden">
                <table
                  data-testid="rbac-s06-members-table"
                  className="w-full text-sm"
                >
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Name
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                        Email
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Role
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Change Role
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => (
                      <MemberRoleRow
                        key={member.id}
                        member={member}
                        onRoleChange={(role) =>
                          updateRoleMutation.mutate({
                            memberId: member.id,
                            businessRole: role,
                          })
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MemberRoleRow({
  member,
  onRoleChange,
}: {
  member: EnrichedMember;
  onRoleChange: (role: string) => void;
}) {
  const displayName = member.userName ?? member.principalId;
  const displayEmail = member.userEmail ?? "-";

  return (
    <tr
      data-testid={`rbac-s06-members-row-${member.id}`}
      className="border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors"
    >
      <td
        data-testid={`rbac-s06-members-name-${member.id}`}
        className="px-4 py-2.5 font-medium"
      >
        {displayName}
      </td>
      <td
        data-testid={`rbac-s06-members-email-${member.id}`}
        className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell"
      >
        {displayEmail}
      </td>
      <td
        data-testid={`rbac-s06-members-role-${member.id}`}
        className="px-4 py-2.5"
      >
        <RoleBadge role={member.businessRole as string} />
      </td>
      <td className="px-4 py-2.5">
        <Select
          value={member.businessRole}
          onValueChange={(val) => onRoleChange(val as string)}
        >
          <SelectTrigger
            data-testid={`rbac-s06-members-change-role-${member.id}`}
            size="sm"
            className="w-[130px] h-7 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
              <SelectItem key={role} value={role}>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
    </tr>
  );
}
