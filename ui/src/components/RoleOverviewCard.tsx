import type { string } from "@mnm/shared";
import { RoleBadge } from "./RoleBadge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Full access to all features and settings",
  manager: "Day-to-day management, no system admin",
  contributor: "Daily productivity — launch agents, create stories",
  viewer: "Read-only access to audit logs and dashboards",
};

interface RoleOverviewCardProps {
  role: string;
  permissionCount: number;
  memberCount: number;
}

export function RoleOverviewCard({
  role,
  permissionCount,
  memberCount,
}: RoleOverviewCardProps) {
  return (
    <Card
      data-testid={`rbac-s06-role-card-${role}`}
      className="rounded-lg"
    >
      <CardHeader className="pb-0">
        <RoleBadge role={role} />
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {ROLE_DESCRIPTIONS[role]}
        </p>
        <div className="flex items-center gap-4 text-sm">
          <span data-testid={`rbac-s06-role-card-${role}-count`}>
            {permissionCount} permissions
          </span>
          <span
            data-testid={`rbac-s06-role-card-${role}-members`}
            className="text-muted-foreground"
          >
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
