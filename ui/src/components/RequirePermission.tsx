import type { ReactNode } from "react";
import type { PermissionKey } from "@mnm/shared";
import { usePermissions } from "../hooks/usePermissions";
import { ForbiddenPage } from "../pages/Forbidden";

/**
 * Wrapper component that conditionally renders children based on a permission key.
 * If the user lacks the required permission:
 * - Shows <ForbiddenPage> if `showForbidden` is true (for route-level protection)
 * - Renders nothing otherwise (for element-level hiding)
 */
export function RequirePermission({
  permission,
  children,
  fallback,
  showForbidden = false,
}: {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
  showForbidden?: boolean;
}) {
  const { hasPermission, isLoading } = usePermissions();

  if (isLoading) return null;

  if (!hasPermission(permission)) {
    if (showForbidden) return <ForbiddenPage />;
    return fallback ? <>{fallback}</> : null;
  }

  return <div data-testid="rbac-s05-route-guard">{children}</div>;
}
