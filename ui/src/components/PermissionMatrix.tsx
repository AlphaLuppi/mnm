import React from "react";
import { Check, Minus } from "lucide-react";
import type { string, string } from "@mnm/shared";

/** Permission categories with their labels and keys, in display order. */
const PERMISSION_CATEGORIES: Array<{
  id: string;
  label: string;
  keys: string[];
}> = [
  {
    id: "agents",
    label: "Agents",
    keys: ["agents:create", "agents:launch", "agents:manage_containers"],
  },
  {
    id: "users",
    label: "Users",
    keys: ["users:invite", "users:manage_permissions", "joins:approve"],
  },
  {
    id: "tasks",
    label: "Tasks",
    keys: ["tasks:assign", "tasks:assign_scope"],
  },
  {
    id: "projects",
    label: "Projects",
    keys: ["projects:create", "projects:manage_members"],
  },
  {
    id: "workflows",
    label: "Workflows",
    keys: ["workflows:create", "workflows:enforce"],
  },
  {
    id: "company",
    label: "Company",
    keys: ["company:manage_settings", "company:manage_sso"],
  },
  {
    id: "audit",
    label: "Audit",
    keys: ["audit:read", "audit:export"],
  },
  {
    id: "stories",
    label: "Stories",
    keys: ["stories:create", "stories:edit"],
  },
  {
    id: "dashboard",
    label: "Dashboard",
    keys: ["dashboard:view"],
  },
  {
    id: "chat",
    label: "Chat",
    keys: ["chat:agent"],
  },
];

const PERMISSION_LABELS: Record<string, string> = {
  "agents:create": "Create agents",
  "agents:launch": "Launch agents",
  "agents:manage_containers": "Manage containers",
  "users:invite": "Invite users",
  "users:manage_permissions": "Manage permissions",
  "tasks:assign": "Assign tasks",
  "tasks:assign_scope": "Assign task scope",
  "projects:create": "Create projects",
  "projects:manage_members": "Manage project members",
  "workflows:create": "Create workflows",
  "workflows:enforce": "Enforce workflows",
  "company:manage_settings": "Manage company settings",
  "company:manage_sso": "Manage SSO",
  "audit:read": "View audit log",
  "audit:export": "Export audit data",
  "stories:create": "Create stories",
  "stories:edit": "Edit stories",
  "dashboard:view": "View dashboard",
  "chat:agent": "Chat with agents",
  "joins:approve": "Approve join requests",
};

interface PermissionMatrixProps {
  presets: Record<string, readonly string[]>;
}

export function PermissionMatrix({ presets }: PermissionMatrixProps) {

  function hasPermission(role: string, key: string): boolean {
    const perms = presets[role];
    if (!perms) return false;
    return perms.includes(key);
  }

  return (
    <div data-testid="rbac-s06-matrix" className="border border-border rounded-md overflow-auto">
      <table
        data-testid="rbac-s06-matrix-table"
        className="w-full text-sm"
      >
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th
              scope="col"
              className="text-left px-4 py-2.5 font-medium text-muted-foreground min-w-[200px]"
            >
              Permission
            </th>
            {roles.map((role) => (
              <th
                key={role}
                scope="col"
                data-testid={`rbac-s06-matrix-header-${role}`}
                className="text-center px-4 py-2.5 font-medium text-muted-foreground w-[100px]"
              >
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_CATEGORIES.map((category) => (
            <React.Fragment key={category.id}>
              {/* Category header row */}
              <tr
                data-testid={`rbac-s06-matrix-category-${category.id}`}
                className="bg-muted/20"
              >
                <th
                  scope="row"
                  colSpan={5}
                  className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {category.label}
                </th>
              </tr>
              {/* Permission rows */}
              {category.keys.map((key) => (
                <tr
                  key={key}
                  data-testid={`rbac-s06-matrix-row-${key}`}
                  className="border-b border-border last:border-b-0 hover:bg-accent/20 transition-colors"
                >
                  <th
                    scope="row"
                    className="text-left px-4 py-2 font-normal text-foreground"
                  >
                    {PERMISSION_LABELS[key] ?? key}
                  </th>
                  {roles.map((role) => {
                    const granted = hasPermission(role, key);
                    return (
                      <td
                        key={`${key}-${role}`}
                        data-testid={`rbac-s06-matrix-cell-${key}-${role}`}
                        className="text-center px-4 py-2"
                      >
                        {granted ? (
                          <Check
                            data-testid={`rbac-s06-matrix-check-${key}-${role}`}
                            className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto"
                            aria-label="Granted"
                          />
                        ) : (
                          <Minus
                            data-testid={`rbac-s06-matrix-check-${key}-${role}`}
                            className="h-4 w-4 text-muted-foreground/40 mx-auto"
                            aria-label="Not granted"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
