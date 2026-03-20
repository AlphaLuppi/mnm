import { BUSINESS_ROLE_LABELS, type BusinessRole } from "@mnm/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ROLE_STYLES: Record<BusinessRole, string> = {
  admin: "bg-role-admin-bg text-role-admin border-role-admin/20",
  manager: "bg-role-manager-bg text-role-manager border-role-manager/20",
  contributor: "bg-role-contributor-bg text-role-contributor border-role-contributor/20",
  viewer: "bg-role-viewer-bg text-role-viewer border-role-viewer/20",
};

interface RoleBadgeProps {
  role: BusinessRole;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const label = BUSINESS_ROLE_LABELS[role] ?? role;

  return (
    <Badge
      data-testid={`rbac-s07-role-badge-${role}`}
      variant="outline"
      className={cn(ROLE_STYLES[role], className)}
    >
      {label}
    </Badge>
  );
}
