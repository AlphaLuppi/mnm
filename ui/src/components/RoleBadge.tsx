import { BUSINESS_ROLE_LABELS, type BusinessRole } from "@mnm/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ROLE_STYLES: Record<BusinessRole, string> = {
  admin: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
  manager: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  contributor: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  viewer: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
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
